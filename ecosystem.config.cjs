const path = require("node:path");

module.exports = {
  apps: [
    {
      name: "ty_so",
      script: "serve",
      cwd: __dirname,
      env: {
        PM2_SERVE_PATH: path.join(__dirname, "dist"),
        PM2_SERVE_PORT: 8390,
        PM2_SERVE_SPA: "true",
        PM2_SERVE_HOMEPAGE: "/index.html",
      },
    },
  ],
};
