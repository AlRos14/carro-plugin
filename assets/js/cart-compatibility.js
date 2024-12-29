(async function () {
    async function simulateProductReset(cartItemKey, quantity = 1) {
        try {
            const response = await fetch(cartVariationsData.ajax_url, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    action: "reset_cart_product",
                    cart_item_key: cartItemKey,
                    quantity: quantity,
                }),
            });

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message || "Fallo al restablecer el producto");
            }
            return true;
        } catch (error) {
            console.error("❌ Error durante el restablecimiento:", error);
            return false;
        }
    }

    async function initialize(cartItemKeys) {
        try {
            // Procesar cada ítem del carrito
            for (const cartItemKey of cartItemKeys) {
                // Simular el restablecimiento del producto (ajusta la cantidad según sea necesario)
                const success = await simulateProductReset(cartItemKey, 2);

                if (success) {
                    break; // Solo necesitamos simular un restablecimiento
                }
            }
        } catch (error) {
            console.error("❌ Error durante la inicialización:", error);
        }
    }

    const getCartItemKeys = async () => {
        const response = await fetch(cartVariationsData.ajax_url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                action: "get_cart_items",
            }),
        });

        const data = await response.json();
        if (!data.success && data.data && data.data.gift_already === 'true') {
            return;
        }
        if (!data.success || !Array.isArray(data.data.cart_items)) {
            throw new Error("No se pudieron obtener los ítems del carrito");
        }

        return data.data.cart_items.map((item) => item.key);
    };

    // Inicio del script
    const cartItemKeys = await getCartItemKeys();
    if (cartItemKeys != undefined && cartItemKeys.length > 0) {
        initialize(cartItemKeys);
    }
})();
