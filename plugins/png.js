/**
* ViolentSpoofy PNG plugin
* ------------------------------ 
* Chunk supported : PLTE, tEXt
* tEXt keywords : Title, Author, Creation time, Software, Location, Copyright
* Checksum : CRC32
* 
* @author : Georges.michel <@FrenchYeti>
* @date: 2017/03/10
**/
var ArgParser = require('../libs/cli.js'),
    ps = require('process'),
    fs = require('fs'),
    crc32 = require('../libs/crc32.js');

var pngSpoofer = {
    specification: {
        chunks: ["PLTE","tEXt"], 
        chunk_tEXt_default: "Title",
        chunk_tEXt_range: ["Title","Author","Creation Time","Software","Copyright","Location"],
        format: "png"
    },
    options: [{
        name:'tEXtkeyword',
        arg: '--tEXt-keyword',
        data: ArgParser.STR,
        default: "Software",
        help: 'Keyword for the tEXt chunk'
    },{
        name:'chunk',
        arg: '-c',
        data: ArgParser.STR,
        //default: "PLTE",
        help: 'Chunk where inject the script'
    },{
        name: 'png_help',
        arg: '-h',
        data: ArgParser.NONE,
        callback: (opts)=>{console.log(opts.help); ps.exit(0); }
    }],

    /**
    * Merge src_buffer and paylod by inserting the buffer payload 
    * into src_buffer at the "offset" position
    */    
    _insert: function (src_buffer, payload, offset)
    {
        let first=null, two=null;

        first = src_buffer.slice(0, offset);
        two = src_buffer.slice(offset, src_buffer.length);
        
        return Buffer.concat([first,payload,two], first.length+payload.length+two.length);
    }
};

pngSpoofer.methods = {
    

    // Inject data into tEXt chunk
    pack2text: function (src_buffer, script, opts={keyword:"title"}){

        let payload = null, size = null;
        let textIndex = src_buffer.indexOf("sText");
     
        console.log("\n[*] Checking if tEXt chunk exists");
        if(textIndex == -1){
            console.log("[!] tEXt not exist. Injecting new tEXt chunk of type "+opts.keyword+" ...")   ;
            
            // Format : tEXt , keyword , %00 , script , CRC32
            size = opts.keyword.length+1+script.length;
            
            payload = Buffer.alloc(12+size);
            payload.writeUInt32BE(size,0);
            payload.write("tEXt"+opts.keyword+"\0"+script, 4, size+4, 'ascii');     
            payload.writeInt32BE( crc32.buf(payload.slice(4, 8+size-4)), 8+size);
            
            console.log("[*] New tEXt chunk injected before the IDAT chunk");         
            return pngSpoofer._insert(src_buffer, payload, src_buffer.indexOf("IHDR")+21); // 21= IHDR length
        }else{
            console.log("[*] Updating first tEXt chunk");

            ps.exit(0);
        }
    },

    // Inject data into PLTE chunk
    pack2plte: function pack2plte(src_buffer, script)
    {
        let plteIndex = src_buffer.indexOf("PLTE");
        let buffer = null, newData=null;
        let size = 0, newPlteCRC=0; 

        console.log("PLTE index : ",plteIndex);   

        // Fit the script for PLTE 
        console.log("[*] Checking if script shall be fitted");
        if(script.length%3 > 1){
            script = script.replace(' ',' '.repeat(script.length%3));
            console.log("[*] Script fitted for RGB");
        }        

        // get current PLTE size
        size = src_buffer.readUInt32BE(plteIndex-4);
        
        //console.log("Nombre de couleurs de la palette : "+size/24);   
        // if original PLTE size < new PLTE size then remake the data
        if(size < script.length+8){
            console.log("[*] Creating a new PLTE chunk");
            // Fill PLTE chunk
            // LENGTH (4 bytes) + PLTE (4 bytes) + script.length + CRC32 (4 bytes) 
            buffer = Buffer.alloc(12+script.length);         

            // write LENGTH
            buffer.writeUInt32BE(4+script.length, 0);

            // write "PLTE"            
            buffer.write("PLTE", 4, 4);

            // write PLTE data i.e. the fitted script            
            buffer.write(script, 8, script.length);

            // write th CRC
            newPlteCRC = crc32.buf( src_buffer.slice(plteIndex,size)); 
            buffer.writeInt32BE( ~newPlteCRC, 8+script.length);

            // make data
            prePlte = src_buffer.slice(0, plteIndex-4);
            postPlte = src_buffer.slice(plteIndex+size, src_buffer.length);
            src_buffer = Buffer.concat([prePlte,buffer,postPlte], prePlte.length+buffer.length+postPlte.length);
            
            console.log("[*] New PLTE chunk injected");            
        }
        // else override the begin of the original PLTE chunk
        else{
            src_buffer.write(script, plteIndex+4);
	    // calc new CRC32 chceksum
            //console.log("Prepare CRC32 for :",plteIndex,size,data.slice(plteIndex,plteIndex+size+4));                        
            newPlteCRC = crc32.buf( src_buffer.slice(plteIndex,plteIndex+size+4)); 
            src_buffer.writeInt32BE( newPlteCRC, plteIndex+size+4);

            console.log("[*] Current PLTE updated");
        }
        
        return src_buffer;
    }    
};

pngSpoofer.perform = function(src_file, cmdOpts){
    
    fs.readFile(src_file, (err, data)=>{
        let plteIndex = 0;
        let buffer = null, newData=null;

        if(err) throw err;
           
        // perform mutation
        console.log("[*] File mutating ... \n");   
        
        switch(cmdOpts.chunk){
            case "PLTE":
                newData = pngSpoofer.methods.pack2plte(data, cmdOpts.script);
                break;
            case "tEXt":
                newData = pngSpoofer.methods.pack2text(data, cmdOpts.script, {keyword: cmdOpts.tEXtkeyword});
                break;
            default:
                console.log("[*] Checking if PLTE chunk exists");
                plteIndex = data.indexOf("PLTE");
                if(plteIndex == -1){
                    console.log("[!] Invalid file : PLTE chunk not found");
                    //console.log("[*] Creating tEXt chunk ...");
                    newData = pngSpoofer.methods.pack2text(data, cmdOpts.script,  {keyword: cmdOpts.tEXtkeyword});
                }        
                // if SCRIPT is larger than max PLTE size, try sTEXT
                else if(cmdOpts.script.length > (256*3)){
                    console.log("[!] PLTE chunk too small");
                    //console.log("[!] Searching for sTEXT chunk ...");
                    //console.log("[*] Creating tEXt chunk ...");
                    newData = pngSpoofer.methods.pack2text(data, cmdOpts.script, {keyword: cmdOpts.tEXtkeyword});
                }        
                else{
                    newData = pngSpoofer.methods.pack2plte(data, cmdOpts.script)
                }  
                break;
        }        

    
        // create file
        fs.open(cmdOpts.out_file,'w+', (err, fd)=>{
            fs.write(fd, newData, 0, newData.length, 0, (err, written, buffer)=>{
                if(err) throw err;

                console.log("\n[*] File mutated : "+cmdOpts.out_file);            
                fs.close(fd,(err)=>{ ps.exit(0) });
            });
        });
    });
}

module.exports = pngSpoofer;
