FROM php:7.4-apache

# PHP extensions for XML-RPC + cURL
RUN apt-get update && apt-get install -y \
    libxml2-dev \
    libcurl4-openssl-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN docker-php-ext-install xmlrpc curl

# Apache mod_rewrite + .htaccess support
RUN a2enmod rewrite
RUN sed -i '/<Directory \/var\/www\/>/,/<\/Directory>/ s/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf

# Cache directory with correct permissions
RUN mkdir -p /var/www/html/cache && chown www-data:www-data /var/www/html/cache

# PHP tuning for large wikis
RUN echo "memory_limit=256M" > /usr/local/etc/php/conf.d/knowledgegraph.ini \
    && echo "max_execution_time=600" >> /usr/local/etc/php/conf.d/knowledgegraph.ini

EXPOSE 80
