//這邊程式碼可以放到cdn
import express from 'express'; //載入express框架模組
import path from 'path';

export default class {		//算是一種API(應該...
    constructor(port) {
        this.application = express();
        this.port = port;
        // this.application.use(bodyParser.json());
        // this.pool;
        this.__dirname = path.resolve();
        this.application.use((_, res, next) => {
            res.header('Cross-Origin-Opener-Policy', 'same-origin');
            res.header('Cross-Origin-Embedder-Policy', 'require-corp');
            next();
        });
    }
    get app() {
        return this.application;
    }
    start() {
        this.application.listen(this.port, () => console.log(`Listening on port ${this.port}`))
    }
    setupHomepage(file) {
        //讓localhost:3000/ 時會執行index.html
        // __dirname -> 這個專案他的資料位置，也就是package.json這個檔案的資料夾路徑
        this.application.get('/', (req, res) => { 
            res.sendFile(this.__dirname + file);
        });
    }



}




