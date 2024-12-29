<?php
/**
 * Plugin Name: Carro
 * Description: Añade selectores de variaciones al carrito de WooCommerce. Arregla problemas de plugins pensados para el anterior carrito de Woocommerce
 * Version: 1.0.1
 * Author: Alejandro Rosado
 * Text Domain: carro-plugin
 */

if (!defined('ABSPATH')) {
    exit; // Evitar acceso directo
}

// Incluir el archivo principal del plugin
require_once plugin_dir_path(__FILE__) . 'includes/cart-variations-functions.php';
