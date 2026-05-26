module.exports = {
  apps: [
    {
      name: "oneserver-website",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: "/var/www/oneserver/apps/website",
      env: { NODE_ENV: "production", PORT: 3000 }
    }
  ]
};
