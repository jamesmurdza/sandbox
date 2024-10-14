# Use the official PHP 8.2 FPM image from Docker Hub
FROM php:8.2-fpm

# Install necessary PHP extensions for Laravel
RUN apt-get update && apt-get install -y \
    libpng-dev libjpeg-dev libfreetype6-dev libzip-dev unzip git curl libonig-dev libxml2-dev && \
    docker-php-ext-configure gd --with-freetype --with-jpeg && \
    docker-php-ext-install pdo pdo_mysql mbstring exif pcntl bcmath gd zip

# Install Composer
RUN curl -sS https://getcomposer.org/installer | php && \
    mv composer.phar /usr/local/bin/composer && \
    chmod +x /usr/local/bin/composer

## Step 3: Install Laravel Installer globally using Composer for the non-root user
ENV COMPOSER_HOME="/home/user/.composer"
RUN composer global require laravel/installer

RUN mkdir -p /home/user

# Add Composer's global bin directory to PATH for all users
ENV PATH="/home/user/.config/composer/vendor/bin:/home/user/.composer/vendor/bin:${PATH}"

# Make sure the PATH is also updated for root and any other users
RUN echo 'export PATH="/home/user/.composer/vendor/bin:${PATH}"' >> /etc/bash.bashrc

# Step 4: Create a directory for the Laravel project and set permissions
WORKDIR /home/user

# This command breaks inside docker:
#RUN laravel new myproject --force --no-interaction

RUN composer create-project --prefer-dist laravel/laravel myproject

# Navigate to the Laravel project and run Composer update and dump-autoload
WORKDIR /home/user/myproject/
RUN composer update && composer dump-autoload