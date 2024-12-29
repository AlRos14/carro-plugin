<?php
if (!defined('ABSPATH')) {
    exit; // Evitar acceso directo
}

// === Registrar menú en el administrador ===
add_action('admin_menu', 'custom_plugin_admin_menu');
function custom_plugin_admin_menu() {
    add_menu_page(
        'Configuración de Carro', // Título de la página
        'Carro', // Nombre del menú
        'manage_options', // Capacidad necesaria
        'cart-scripts-settings', // Slug del menú
        'cart_scripts_settings_page', // Función para renderizar la página
        'dashicons-cart', // Icono del menú (puedes cambiarlo según tus necesidades)
        25 // Posición en el menú
    );
}

// === Renderizar la página de configuración ===
function cart_scripts_settings_page() {
    // Guardar la configuración si se envía el formulario
    if (isset($_POST['submit'])) {
        check_admin_referer('cart_scripts_settings_nonce');
        $enable_script = isset($_POST['enable_cart_compatibility']) ? '1' : '0';
        update_option('enable_cart_compatibility', $enable_script);
        echo '<div class="updated"><p>Configuración actualizada.</p></div>';
    }

    // Obtener el estado actual del script
    $enable_script = get_option('enable_cart_compatibility', '0');
    ?>
    <div class="wrap">
        <h1>Configuración de Carro</h1>
        <form method="post" action="">
            <?php wp_nonce_field('cart_scripts_settings_nonce'); ?>
            <table class="form-table">
                <tr>
                    <th scope="row">Habilitar script de compatibilidad</th>
                    <td>
                        <label>
                            <input type="checkbox" name="enable_cart_compatibility" value="1" <?php checked($enable_script, '1'); ?> />
                            Activar compatibilidad con plugins de regalos (probado solo con JAGIF)
                        </label>
                    </td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>
    </div>
    <?php
}

// === Registrar y encolar scripts ===
function custom_cart_variation_scripts() {
    // Registro del script principal de variaciones
    wp_register_script(
        'cart-variations-script',
        plugin_dir_url(__FILE__) . '../assets/js/cart-variations.js',
        array('jquery', 'wc-blocks-registry', 'wc-blocks-data-store'),
        '1.0.0',
        true
    );

    // Encolar el script principal
    wp_enqueue_script('cart-variations-script');

    // Verificar si el script de compatibilidad está habilitado
    $enable_script = get_option('enable_cart_compatibility', '0');
    if ($enable_script === '1') {
        wp_register_script(
            'cart-compatibility-script',
            plugin_dir_url(__FILE__) . '../assets/js/cart-compatibility.js',
            array('jquery', 'cart-variations-script'),
            '1.0.0',
            true
        );
        wp_enqueue_script('cart-compatibility-script');
    }

    // Precargar datos de variaciones para el carrito actual
    $cart_data = array(
        'variations' => array()
    );

    if (WC()->cart) {
        foreach (WC()->cart->get_cart() as $cart_item_key => $cart_item) {
            if ($cart_item['data']->is_type('variation')) {
                $parent_id = $cart_item['data']->get_parent_id();
                $parent_product = wc_get_product($parent_id);
                if ($parent_product) {
                    $variations = array();
                    foreach ($parent_product->get_children() as $variation_id) {
                        $variation = wc_get_product($variation_id);
                        if ($variation && $variation->is_purchasable()) {
                            $variations[] = array(
                                'id' => $variation_id,
                                'name' => wp_strip_all_tags($variation->get_name()),
                                'current' => ($variation_id == $cart_item['variation_id'])
                            );
                        }
                    }
                    $cart_data['variations'][$cart_item_key] = $variations;
                }
            }
        }
    }

    wp_localize_script(
        'cart-variations-script',
        'cartVariationsData',
        array_merge(
            $cart_data,
            array(
                'ajax_url' => admin_url('admin-ajax.php'),
                'security' => wp_create_nonce('cart_variations_nonce')
            )
        )
    );
}
add_action('wp_enqueue_scripts', 'custom_cart_variation_scripts', 5);


// Manejar las variaciones del carrito
add_action('wp_ajax_update_cart_variation', 'update_cart_variation');
add_action('wp_ajax_nopriv_update_cart_variation', 'update_cart_variation');

function update_cart_variation() {
    $cart_item_key = isset($_POST['cart_item_key']) ? sanitize_text_field($_POST['cart_item_key']) : '';
    $variation_id = isset($_POST['variation_id']) ? intval($_POST['variation_id']) : 0;

    if (!$cart_item_key || !$variation_id) {
        wp_send_json_error(['message' => 'Datos incompletos.']);
    }

    $cart = WC()->cart;
    $cart_item = $cart->get_cart_item($cart_item_key);

    if (!$cart_item) {
        wp_send_json_error(['message' => 'Artículo no encontrado en el carrito.']);
    }

    $product_id = $cart_item['product_id'];
    $quantity = $cart_item['quantity'];

    $cart->remove_cart_item($cart_item_key);
    $cart->add_to_cart($product_id, $quantity, $variation_id);

    wp_send_json_success(['message' => 'Carrito actualizado correctamente.']);
}

// Obtener las variaciones del producto
add_action('wp_ajax_get_product_variations', 'get_product_variations');
add_action('wp_ajax_nopriv_get_product_variations', 'get_product_variations');

function get_product_variations() {
    if (!class_exists('WooCommerce')) {
        wp_send_json_error(['message' => 'WooCommerce no está activo.']);
        return;
    }

    $cart_item_key = isset($_POST['cart_item_key']) ? sanitize_text_field($_POST['cart_item_key']) : '';
    if (empty($cart_item_key)) {
        wp_send_json_error(['message' => 'Cart item key no proporcionada.']);
        return;
    }

    $cart = WC()->cart;
    $cart_item = $cart->get_cart_item($cart_item_key);

    if (!$cart_item) {
        wp_send_json_error(['message' => 'Item del carrito no encontrado.']);
        return;
    }

    $product = $cart_item['data'];

    if ($product->is_type('variation')) {
        $parent_id = $product->get_parent_id();
        $parent_product = wc_get_product($parent_id);
        if (!$parent_product) {
            wp_send_json_error(['message' => 'Producto padre no encontrado.']);
            return;
        }
        $variations = $parent_product->get_children();
    } else {
        wp_send_json_error(['message' => 'El producto no es una variación.']);
        return;
    }

    $variations_array = [];
    foreach ($variations as $variation_id) {
        $variation_product = wc_get_product($variation_id);
        if ($variation_product) {
            $variation_name = wp_strip_all_tags($variation_product->get_name());
            $variations_array[] = [
                'id' => $variation_id,
                'name' => $variation_name,
                'current' => ($variation_id == $product->get_id())
            ];
        }
    }

    wp_send_json_success($variations_array);
}

// Obtener los ítems del carrito
add_action('wp_ajax_get_cart_items', 'get_cart_items');
add_action('wp_ajax_nopriv_get_cart_items', 'get_cart_items');

function get_cart_items() {
    if (!class_exists('WooCommerce')) {
        wp_send_json_error(['message' => 'WooCommerce no está activo.']);
        return;
    }

    $cart = WC()->cart;
    foreach ($cart->get_cart() as $cart_item) {
        if ($cart_item['data']->get_price() == 0) {
            wp_send_json_error(['gift_already' => 'true']);
            return;
        }
    }

    if (!$cart) {
        wp_send_json_error(['message' => 'No se pudo obtener el carrito.']);
        return;
    }

    $cart_items = $cart->get_cart();

    if (empty($cart_items)) {
        wp_send_json_error(['message' => 'El carrito está vacío.']);
        return;
    }

    $formatted_items = [];
    foreach ($cart_items as $cart_item_key => $cart_item) {
        $product = $cart_item['data'];
        $formatted_items[] = [
            'key' => $cart_item_key,
            'product_id' => $product->get_id(),
            'name' => $product->get_name(),
            'quantity' => $cart_item['quantity'],
            'is_variation' => $product->is_type('variation'),
            'variation_id' => $product->is_type('variation') ? $product->get_id() : null,
        ];
    }

    // Devolver los ítems directamente sin envolver en 'data'
    wp_send_json_success(['cart_items' => $formatted_items]);
}

add_action('wp_ajax_reset_cart_product', 'reset_cart_product');
add_action('wp_ajax_nopriv_reset_cart_product', 'reset_cart_product');

function reset_cart_product() {
    if (!class_exists('WooCommerce')) {
        wp_send_json_error(['message' => 'WooCommerce no está activo.']);
        return;
    }

    $cart_item_key = isset($_POST['cart_item_key']) ? sanitize_text_field($_POST['cart_item_key']) : '';
    
    if (empty($cart_item_key)) {
        wp_send_json_error(['message' => 'Cart item key no proporcionada.']);
        return;
    }

    $cart = WC()->cart;

    $cart_item = $cart->get_cart_item($cart_item_key);

    if (!$cart_item) {
        wp_send_json_error(['message' => 'Ítem del carrito no encontrado.']);
        return;
    }

    // Obtener el ID del producto y sus variaciones (si las hay)
    $product_id = $cart_item['product_id'];
    $quantity = $cart_item['quantity'];
    $variation_id = isset($cart_item['variation_id']) && $cart_item['variation_id'] > 0 ? $cart_item['variation_id'] : 0;
    $variations = isset($cart_item['variation']) ? $cart_item['variation'] : [];

    // Eliminar el producto del carrito
    $cart->remove_cart_item($cart_item_key);

    // Añadir el producto de nuevo al carrito
    $added = $cart->add_to_cart($product_id, $quantity, $variation_id, $variations);

    if (!$added) {
        wp_send_json_error(['message' => 'No se pudo añadir el producto al carrito.']);
    } else {
        wp_send_json_success(['message' => 'Producto restablecido correctamente.', 'cart_item_key' => $added]);
    }
}
