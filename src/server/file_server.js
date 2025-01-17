import {
  writeFileSync,
  readFileSync,
  existsSync,
  lstatSync,
} from "fs";

function getHttpError(code) {
  const errorCodes = [
    {
      code: 200,
      label: "OK",
      message: "Everything is good, you shouldn't even see this."
    },
    {
      code: 404,
      label: "Not Found",
      message: "The file was not found."
    },
    {
      code: 403,
      label: "Forbidden",
      message: "You are not allowed here."
    },
    {
      code: 500,
      label: "Internal Server Error",
      message: "Server occurred a problem."
    }
  ];

  //            <  ---          Query          ---  >    <  ---        Default         ---  >
  const error = errorCodes.find(e => e.code === code) || errorCodes.find(e => e.code === 500);

  let template = `
        <h1>${error.code} ${error.label}</h1>
        <p>${error.message}</p>

        <hr>
        <footer>MsgRoom Custom Server - <a href='/credits'>Credits</a></footer>

        <!-- Real cool feature (fantasticat) -->
        <img id="catdotjpg" src="https://http.cat/images/${error.code}.jpg" style="height: 150px;">

        <style>
            body {
                text-align: center;
            }

            #catdotjpg {
                opacity: 1;
                user-select: none;
                pointer-events: none;

                animation: cat-appear 60s linear;
            }

            @keyframes cat-appear {
                from {
                    opacity: 0;
                }
            }
        </style>
    `;

  return template;
}

export function handle(http) {
  /**
* On http request on port chosen
*/
  http.on("request", async (req, res) => {
    let fetchUrl = req.url;
    let url = fetchUrl;

    if (url.startsWith(process.env.API_ENDPOINT))
      return; // Return if trying to access API

    var GET = {};
    var POST = {};
    var GETtemp = "";

    var cookies = {};

    let params = url.split('?');
    if (params[1]) {
      url = params[0];
      GETtemp = params[1];
    }

    if (req.method === "POST") {
      req.on('data', (chunk) => {
        if (chunk) {
          POST += chunk.toString();
        }
      });

      req.on('end', () => {
        let pairs = POST.split("&");
        let obj = {};
        pairs.forEach(pair => {
          let value = pair.split("=");
          obj[value[0]] = value[1] || '';
        });
        POST = obj;
      });
    }

    if (req.headers.cookie) {
      req.headers.cookie.split(';').forEach(cookie => {
        const parts = cookie.split('=');
        const name = parts.shift().trim();
        const value = decodeURIComponent(parts.join('='));
        cookies[name] = value;
      });
    }

    if (GETtemp) {
      let pairs = GETtemp.split("&");
      let obj = {};
      pairs.forEach(pair => {
        let value = pair.split("=");
        obj[value[0]] = value[1] || '';
      });
      GET = obj;
    }

    if (url === "/socket.io/") {
      // res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      // res.end();
      return;
    }

    // Search for the requested path
    switch (url) {
      case "/": {
        url = "/index.html";
        break;
      }
    }

    let fileUrl = null;

    // e.g. /hello => /web/hello
    if (existsSync(`./src/web${url}`) && lstatSync(`./src/web${url}`).isFile())
      fileUrl = `./src/web${url}`;

    // e.g. /hello.html => /web/hello.html
    else if (existsSync(`./src/web${url}.html`) && lstatSync(`./src/web${url}.html`).isFile())
      fileUrl = `./src/web${url}.html`;

    // e.g. /hello.htm => /web/hello.htm
    else if (existsSync(`./src/web${url}.htm`) && lstatSync(`./src/web${url}.htm`).isFile())
      fileUrl = `./src/web${url}.htm`;

    // e.g /hello => redirect to /web/hello/
    else if (!url.endsWith("/") && existsSync(`./src/web${url}/`) && lstatSync(`./src/web${url}/`).isDirectory()) {
      console.debug(`Redirecting ${url} to ${url}/`);
      res.writeHead(301, { "Location": `${url}/` });
      res.end();
      return;
    }

    // e.g. /hello/ => /web/hello/index.html
    else if (existsSync(`./src/web${url}index.html`) && lstatSync(`./src/web${url}index.html`).isFile())
      fileUrl = `./src/web${url}index.html`;

    // Define default values
    let code = 404;
    let content = getHttpError(404);
    let extension = "html";

    if (fileUrl === './src/web/admin/logged.html' || fileUrl === './src/web/admin/logged.html') {
      let key = null;
      url = "./src/web/admin/index.html";

      if (GET['passkey']) {
        key = GET['passkey'];
      } else if ('passkey' in cookies) {
        key = cookies['passkey']
      }
      if (key === process.env.ADMIN_SECRET) url = "./src/web/admin/logged.html";
      content = readFileSync(url);
      res.writeHead(200, undefined, { "Content-Type": "text/html" });
      res.end(content);
      return;
    } else if(fileUrl === './src/web/admin/logged.js') {
      let key = null;
      if (GET['passkey']) {
        key = GET['passkey'];
      } else if ('passkey' in cookies) {
        key = cookies['passkey']
      }
      if (key !== process.env.ADMIN_SECRET) {
        res.writeHead(200, undefined, { "Content-Type": "text/html" });
        res.end("\"You are not logged in........\"");
        return;
      };
      content = readFileSync(fileUrl);
      res.writeHead(200, undefined, { "Content-Type": "text/javascript" });
      res.end(content);
      return;
    }

    // Set Extension
    if (fileUrl) {
      code = 200;
      content = readFileSync(fileUrl);
      extension = fileUrl.slice(fileUrl.lastIndexOf(".") + 1);
    }

    let log = req.method + " " + url + " from " + req.socket.remoteAddress;

    if (GET) {
      log += "\nGET: " + JSON.stringify(GET);
    }
    if (POST) {
      log += "\nPOST: " + JSON.stringify(POST);
    }
    if (cookies) {
      log += "\nCookies: " + JSON.stringify(cookies);
    }

    log += "\n-------------------";

    // console.log(log);

    // Define Headers
    const mimeMap = new Map([
      [["html", "htm"], "text/html"],
      [["css"], "text/css"],
      [["js"], "text/javascript"],
      [["json"], "application/json"],
      [["woff"], "font/woff"],
      [["woff2"], "font/woff2"],
      [["txt", "log"], "text/plain"],
    ]);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Content-Type",
      [...mimeMap.entries()].find(([exts, _]) => exts.includes(extension))?.[1] || "application/octet-stream"
    );

    // Return the value
    try {
      res.writeHead(code);
      res.end(content);
    } catch (e) {
      console.error(e);
    }


  });
}