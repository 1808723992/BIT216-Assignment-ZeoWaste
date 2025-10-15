<?php
// load_env.php — loads the values from .env file into PHP

function loadEnv($path)
{
    if (!file_exists($path)) {
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

    foreach ($lines as $line) {
        if (str_starts_with(trim($line), '#')) {
            continue; // ignore comments
        }

        list($name, $value) = explode('=', $line, 2);
        $name = trim($name);
        $value = trim($value);

        // Remove quotes if any
        $value = trim($value, '"');

        putenv("$name=$value");
    }
}
