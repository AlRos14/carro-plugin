document.addEventListener("DOMContentLoaded", function () {
    let cartItemsCache = JSON.parse(localStorage.getItem("cartItems")) || null;    

    // Llama a la API al cargar el documento
    async function loadCartItems() {
        console.time("fetchCartItems"); // Inicia el temporizador

        try {
            const response = await fetch("/wp-json/wc/store/cart");
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            
            const cartData = await response.json();
            cartItemsCache = cartData.items;
            localStorage.setItem("cartItems", JSON.stringify(cartItemsCache));


            console.timeEnd("fetchCartItems"); // Finaliza el temporizador
            return cartItemsCache;
        } catch (error) {
            console.error("Error fetching cart items:", error);
            console.timeEnd("fetchCartItems"); // Finaliza el temporizador en caso de error
            return [];
        }
    }

    document.body.addEventListener("wc-blocks_added_to_cart", async function () {
        console.log("Evento wc-blocks_added_to_cart detectado. Actualizando elementos del carrito...");
        cartItemsCache = await loadCartItems();
        console.log("Elementos del carrito actualizados:", cartItemsCache);
    });

    async function injectVariationSelector(row, cartItem) {
        const cartItemKey = cartItem.key;

        // Evitar duplicados
        if (row.querySelector(".cart-variation-selector")) return;

        const variationSelector = document.createElement("select");
        variationSelector.classList.add("cart-variation-selector");
        variationSelector.dataset.cartItemKey = cartItemKey;

        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "Selecciona una variación";
        variationSelector.appendChild(defaultOption);

        // Usar datos precargados si están disponibles
        if (cartVariationsData.variations[cartItemKey]) {
            cartVariationsData.variations[cartItemKey].forEach(variation => {
                const option = new Option(variation.name, variation.id, variation.current, variation.current);
                variationSelector.appendChild(option);
            });
        } else {
            fetchVariations(variationSelector, cartItemKey);
        }

        row.querySelector(".wc-block-cart-item__product").appendChild(variationSelector);
    }

    async function injectTestSelector() {
        let cartItems = cartItemsCache;
        if (cartItems == null) {
            console.log("Llamo a loadCartItems");
            cartItems = await loadCartItems(); // Llama a loadCartItems solo una vez
        }
        console.log("Cart items fetched:", cartItems);
    
        const interval = setInterval(() => {
            let cartRows = document.querySelectorAll(".wc-block-cart .wc-block-cart-items__row");
            if (cartRows.length == cartItems.length) {
                if(cartRows.length != cartItems.length) {
                    cartItems = loadCartItems();
                }
                clearInterval(interval); // Detén el intervalo cuando las filas estén disponibles
                console.log("Filas encontradas:", cartRows);
    
                cartRows.forEach((row, index) => {
                    const cartItem = cartItems[index];
                    if (!cartItem) {
                        console.warn(`No hay un elemento del carrito correspondiente para la fila en el índice ${index}.`);
                        return;
                    }
                    if(cartItem.type == 'variation') {
                        console.log(cartItem.type);
                        injectVariationSelector(row, cartItem);
                    }
                    else {
                        return;
                    }
                });
            } else {
                console.log("Esperando filas del carrito...");
            }
        }, 100); // Revisa cada 100ms si las filas están disponibles
    }
    
    
    

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
                    console.log(variation.name + ' ' + variation.id + ' ' + variation.current);
                    const option = new Option(variation.name, variation.id, variation.current, variation.current);
                    variationSelector.appendChild(option);
                });
                console.log("✅ Variations loaded for cart item:", cartItemKey);
            } else {
                console.error("❌ Failed to load variations:", data.message);
            }
        } catch (error) {
            console.error("❌ Error loading variations:", error);
        }
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
                const event = new Event('wc-blocks_added_to_cart');
                document.body.dispatchEvent(event);

                const customEvent = new CustomEvent('wc_blocks_cart_update');
                document.body.dispatchEvent(customEvent);
            }
        } catch (error) {
            console.error("Error updating cart block:", error);
        }
    }

    document.body.addEventListener("change", async function (event) {
        if (event.target.matches(".cart-variation-selector")) {
            const variationSelector = event.target;
            const variationId = variationSelector.value;
            const cartItemKey = variationSelector.dataset.cartItemKey;

            if (!cartItemKey || !variationId) {
                alert("Selecciona una variación válida.");
                return;
            }

            try {
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
                    console.log("✅ Cart updated with new variation.");
                    await updateCartBlock();
                    await cartItemsCache();
                    setTimeout(injectTestSelector, 500);
                } else {
                    alert(data.message || "Failed to update variation.");
                }
            } catch (error) {
                alert("Error updating variation.");
            }
        }
    });

    // Llama a injectTestSelector al cargar el documento
    injectTestSelector();
    
});
