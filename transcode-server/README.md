# Simple transcoding server example #

## • HTTPS or HTTP ##

This server is set to run on **https**, you'll need a pair of pem files for local testing or on the server.

Currently it's looking for `./tmp_certificates/key.pem` and `./tmp_certificates/cert.pem`.

You can switch to **http** *(not recommended for production builds)* by uncommenting this code:
```js
/* http
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
*/
```

and removing or uncommenting the next code

```js
// Start HTTPS Server
https.createServer(options, app).listen(port, () => {
	console.log(`HTTPS Server running on https://localhost:${port}`);
});
```

also you'll not need the certificates any longer for basic HTTP, so remove/comment it out:
```js
// Only needed for HTTPS
const options = {
	key: fs.readFileSync("tmp_certificates/key.pem"), // Path to private key
	cert: fs.readFileSync("tmp_certificates/cert.pem"), // Path to certificate
};
```

## • `www` folder ##

Main code folder is `./src`. The folder `./www` contains an example page on how to interact with the server, you can run it with `npm start:web`

## • Before publishing ##
<span style="color:orange">

The server code is a basic example, for real usage you'll most likely need to remove the files after a certain point.

Could be when request for the output finishes, after a timeout (ex: a day or so) or when a specific output size is hit delete older files.
</span>