mkdir data/ssl -p

# Change this to your domain
cp /etc/letsencrypt/live/cdn.marceldobehere.com/fullchain.pem data/ssl/cert.pem
cp /etc/letsencrypt/live/cdn.marceldobehere.com/privkey.pem data/ssl/key.pem

exec node index.js -https