/**
* ViolentSpoofy PDF plugin
* ------------------------------ 
*
* @author : Georges.michel <@FrenchYeti>
* @date: 2017/03/10
**/
var ArgParser = require('../libs/cli.js'),
    ps = require('process'),
    fs = require('fs'),
    readLine = require('readline'),
    crc32 = require('../libs/crc32.js');

var pdfSpoofer = {
    IN_OBJECT: 1,
	spescification: {
        contentType: ["js","image","audio","video","application"],
        token: "$$_JS_CODE_$$",
        tpl: 
`/Names <<
    /JavaScript <<
      /Names [
        (EmbeddedJS)
        <<
          /S /JavaScript
          /JS (
            $$_JS_CODE_$$
          )
        >>
      ]
    >>
>>`
    },
    options: [{
        name:'content_type',
        arg: '--content-type',
        data: ArgParser.STR,
        // default should be determined by using the MIME type
        default: "js",
        help: 'Chunk where inject the script'
    },{
    	name: 'position',
    	arg: '--payload-offset',
    	// default : BOF | EOF 
    },{
        name: 'pdf_help',
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
    },
    
    _isBeginOfObject: function(data){
    	let o={}, r=/([0-9]+)\s([0-9]+)\s(obj)/g;
    	let res=console.log(data,r.exec(data));
    	if(res != null)
    		return {oid:res[1], gid:res[2], type:res[3]};
		else
			return null;
    },
    
    _parseObject: function(offset, buffer, oid){
    	let LF="\n", SP="\x20", f=0, l=0, data=null, boo=false;
    	
    	
    },
    
    _isCatalog: function(offset, buffer, oid){
    	let LF="\n", SP="\x20", f=0, l=0, data=null, boo=false;
    	
    	row = buffer.slice(buffer.indexOf(LF, offset));
    	
    },
    
    _searchCatalog: function(offset, oid){
    	
    },
    
    // parse chunks
    _parse: function(src_stream,listener){
    	let LF="\n", SP="\x20", f=0, l=0, data=null, boo=false;
    
    	let lineReader = readLine.createInterface({
    		input : src_stream
    	});    
        console.log(lineReader);
        lineReader.on('line', function(line){
            console.log(line);
    		if(l>0){
    			// parse content
    			if(pdfSpoofer.isBeginOfObject(line)){
    				state = pdfSpoofer.IN_OBJECT;
                    console.log("Object Found line "+l);
    			}
    		}
    		else if(l==0 && line.substr(0,4) == "%PDF"){
                console.log("Head found");
    			// parse header
    			listener('head',{
                    type:"PDF",
                    version:data.split('-')[1]
                });
    			l++;
    		}
    		console.log("Unknow file type");
    	});
    	
    	// parse head %PDF-x.b
    	
    	// parse objects
    	/*l = src_buffer.indexOf(LF,++f);
    	data = src_buffer.slice(f,l).toString();
    	
    	if((boo = pdfSpoofer._isBeginOfObject(data)) != null){
    		pdfSpoofer._isCatalog();
    		
    		obj = pdfSpoofer._parseObject(f, boo);
    		obj = {
	    		id:data.slice(0,data.indexOf(SP)).toString(),
	    	}
	    	if(obj.id != null){
	    		listener('object',obj);
	    	}
    	}*/
    }
};

// search page obj, search last object, create new object, change the first page object

pdfSpoofer.methods = {
    


    newJsChunk: function(src_buffer, script, opts){
    	console.log("[*] Checking requirements (object reference, etc ...)");
    	
    },

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


pdfSpoofer.perform = function(src_file, args){
    let plteIndex = 0;
    let buffer = null, newData=null;
    //console.log("SRC",src_file);
    let file_stream = fs.createReadStream(src_file);
        
    pdfSpoofer._parse(file_stream,function(evt,obj){
    	if(evt == 'head')
    		console.log("PDF header",obj);
    	else if(evt == 'object')
    		console.log("Object",obj);
    	
    })
    
    console.log("[*] Selecting appropriate method")
    ps.exit(0);
    /*switch(args.content_type){
    	case "js":
    		newData = pdfSpoofer.methods.newJsChunk(data, args.script, args);
    		break;
    	case "images":
    		newData = pdfSpoofer.methods.newJsChunk(data, args.script);
    		break;
    	case "audio":
    		newData = pdfSpoofer.methods.newJsChunk(data, args.script);
    		break;
    	case "application":
    		// switch video/appl (flash)
    		newData = pdfSpoofer.methods.newAppChunk(data, args.script);
    		break;
    	default:
    		console.log("[!] PDF plugin : error, content type not supported");
    		ps.exit(0);
    		break;
    }*/
    
    return newData;
}

module.exports = pdfSpoofer;
