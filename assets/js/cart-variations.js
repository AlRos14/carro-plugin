//TODO:
// -Si falla al inyectar una variacion probar 1 vez mas restableciendo el cache
document.addEventListener("DOMContentLoaded", function () {
    let cartItemsCache = null;
    const CACHE_KEY = "cartItems";
    const CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutos

    async function fetchVariations(variationSelector, cartItemKey) {
        try {
            const response = await fetch(cartVariationsData.ajax_url, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    action: "get_product_variations",
                    cart_item_key: cartItemKey,
                }),
            });

            const data = await response.json();
            if (data.success) {
                data.data.forEach(variation => {
                    const option = new Option(variation.name, variation.id, variation.current, variation.current);
                    variationSelector.appendChild(option);
                });
            } else {
                console.error("❌ Failed to load variations:", data.message);
            }
        } catch (error) {
            console.error("❌ Error loading variations:", error);
        }
    }

    async function loadCartItems(forceRefresh = false) {
        // Si tenemos cache en memoria, la usamos primero
        if (!forceRefresh && cartItemsCache) {
            return cartItemsCache;
        }

        // Si no hay cache en memoria pero no forzamos refresh, intentamos localStorage
        if (!forceRefresh) {
            const cachedData = localStorage.getItem(CACHE_KEY);
            if (cachedData) {
                const { items, timestamp } = JSON.parse(cachedData);
                const isValid = Date.now() - timestamp < CACHE_TIMEOUT;
                
                if (isValid) {
                    cartItemsCache = items;
                    return items;
                }
            }
        }

        // Solo llamamos a la API si no hay cache válida o se fuerza refresh
        try {
            const response = await fetch("/wp-json/wc/store/cart");
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            
            const cartData = await response.json();
            cartItemsCache = cartData.items;
            
            // Actualizamos localStorage
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                items: cartItemsCache,
                timestamp: Date.now()
            }));
            
            return cartItemsCache;
        } catch (error) {
            console.error("Error fetching cart items:", error);
            return [];
        }
    }

    async function injectVariationSelector(row, cartItem) {
        const cartItemKey = cartItem.key;
        
        // Limpiamos selectores existentes
        const existingSelector = row.querySelector(".cart-variation-selector");
        if (existingSelector) {
            existingSelector.remove();
        }

        const variationSelector = document.createElement("select");
        variationSelector.classList.add("cart-variation-selector");
        variationSelector.dataset.cartItemKey = cartItemKey;

        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "Selecciona una variación";
        variationSelector.appendChild(defaultOption);

        if (cartVariationsData.variations[cartItemKey]) {
            cartVariationsData.variations[cartItemKey].forEach(variation => {
                const option = new Option(variation.name, variation.id, variation.current, variation.current);
                variationSelector.appendChild(option);
            });
        } else {
            await fetchVariations(variationSelector, cartItemKey);
        }

        row.querySelector(".wc-block-cart-item__product").appendChild(variationSelector);
    }

    async function injectTestSelector(forceRefresh = false) {
        try {
            // Usamos forceRefresh solo cuando es necesario (ej: después de un cambio)
            cartItemsCache = await loadCartItems(forceRefresh);
            
            await waitForRowsToLoad();
            
            const cartRows = document.querySelectorAll(".wc-block-cart .wc-block-cart-items__row");

            if(cartRows.length != cartItemsCache.length && cartRows.length != 0) {
                cartItemsCache = await loadCartItems(true);
            }
            
            for (let index = 0; index < cartRows.length; index++) {
                const cartItem = cartItemsCache[index];
                if (!cartItem) {
                    console.warn(`No cart item found for row at index ${index}`);
                    continue;
                }
                if(cartItem.type != 'variation') {
                    continue;
                }
                await injectVariationSelector(cartRows[index], cartItem);
            }
        } catch (error) {
            console.error("Error in injectTestSelector:", error);
        }
    }
    
    async function waitForRowsToLoad(timeout = 10000) {
        const startTime = Date.now();
        const cartContainer = document.querySelector('.wp-block-woocommerce-cart');
        
        if (!cartContainer) {
            return;
        }
        return new Promise((resolve, reject) => {
            const interval = setInterval(() => {
                const cartRows = document.querySelectorAll(".wc-block-cart .wc-block-cart-items__row");
                
                // Si no hay filas, continuamos esperando
                if (cartRows.length === 0) {
                    
                    // Solo verificamos timeout
                    if (Date.now() - startTime > timeout) {
                        clearInterval(interval);
                        reject(new Error("Timeout waiting for rows to appear"));
                    }
                    return;
                }
    
                // Si hay filas, verificamos si son dinámicas
                const isDynamicRowPresent = Array.from(cartRows).some(row => {
                    const link = row.querySelector('.wc-block-components-product-name');
                    return link && link.getAttribute('href') === "";
                });
                
                if (!isDynamicRowPresent) {
                    clearInterval(interval);
                    resolve();
                    return;
                }
                
                if (Date.now() - startTime > timeout) {
                    clearInterval(interval);
                    reject(new Error("Timeout waiting for rows to load"));
                }
            }, 100);
        });
    }

    async function updateCartBlock() {
        try {
            const response = await fetch('/?wc-ajax=get_refreshed_fragments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (response.ok) {
                document.body.dispatchEvent(new Event('wc-blocks_added_to_cart'));
                await new Promise(resolve => setTimeout(resolve, 100));
                document.body.dispatchEvent(new CustomEvent('wc_blocks_cart_update'));
                
                // Esperamos a que el DOM se actualice
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        } catch (error) {
            console.error("Error updating cart block:", error);
            throw error;
        }
    }

    document.body.addEventListener("change", async function (event) {
        if (!event.target.matches(".cart-variation-selector")) return;

        const variationSelector = event.target;
        const variationId = variationSelector.value;
        const cartItemKey = variationSelector.dataset.cartItemKey;

        if (!cartItemKey || !variationId) {
            alert("Selecciona una variación válida.");
            return;
        }

        try {
            variationSelector.disabled = true;

            const response = await fetch(cartVariationsData.ajax_url, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    action: "update_cart_variation",
                    cart_item_key: cartItemKey,
                    variation_id: variationId,
                }),
            });

            const data = await response.json();
            if (data.success) {
                await updateCartBlock();
                // Aquí sí forzamos refresh porque hubo un cambio
                await injectTestSelector(true);
            } else {
                alert(data.message || "Failed to update variation.");
            }
        } catch (error) {
            console.error("Error updating variation:", error);
            alert("Error updating variation.");
        } finally {
            variationSelector.disabled = false;
        }
    });

    // Inicialización - no forzamos refresh en la carga inicial
    injectTestSelector(false).catch(console.error);
});