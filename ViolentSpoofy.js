#!/usr/bin/node
/**
* Usage : ViolentSpoofy.js [--help] [--list] [-f FORMAT] [-o OUT_FILE] [--force] SRC_FILE SCRIPT
* ----------------------------------------------------
* Tool for make polyglot file (encapsulate a text - like a script - or a file in an other file 
* from an other format and keeping the new file valid and the inserted chunk readable).
* Depending of the type of "host" file and the size of the data to encapsulate, the chunk is 
* different. 
* 
* author: @FrenchYeti <Georges.michel>
* date : 2016/03/02 
*/
    // requires
var ps = require('process'),
    fs = require('fs'),
    crc32 = require('./libs/crc32.js'),
    ArgParser = require('./libs/cli.js'),
    // var
    spoofer = null,
    spooferOpts = null,
    spooferArgs = null;

console.log("[*] Search plugins ... ");
var plugins = fs.readdirSync("./plugins").map(function(a){ return a.substr(0,a.length-3);});

// args
var Arguments = (ArgParser.parser("ViolentSpoofy.js",[{
        name:'help', 
        data: ArgParser.NONE,
        arg: '--help', 
        help:'Print help',
        callback: (opts)=>{ console.log(opts.help); ps.exit(0); }
    },{ 
        name:'list_format',  
        arg: '--list', 
        data: ArgParser.NONE, 
        help:'List supported format',
        callback: (opts)=>{ 
            console.log("List of supported file formats :\n-----------------------------------");
            console.log(fs.readdirSync('./plugins').map((a)=>{return a.split('.').slice(0,-1).join('.') }).join(' , ')); 
            ps.exit(0); 
        }
    },{ 
        name:'format', 
        data: ArgParser.STR,
        arg: '-f', 
        help:'Format to spoof',
        callback: (opts)=>{
            // Default plugin is the first plugin in plugins/ directory
            if(plugins.indexOf(opts.args.format) == -1){
                console.log("\n[!] Plugin "+opts.args.format+" unknow . Available : "+plugins.join(','));
                ps.exit(0);
            }else{
                // load the selected plugin and parse specific args
                spoofer = require('./plugins/'+opts.args.format+".js"); 
                console.log('[*] Plugin select : '+opts.args.format);
                spooferArgs = ArgParser.parser(null, spoofer.options)(process.argv);
            }
        }
    },{ 
        name:'out_file',  
        arg: '-o', 
        default: 'out_1',
        data: ArgParser.STR, 
        help:'Output file path' 
    },{ 
        name:'force', 
        arg:'--force', 
        data: ArgParser.NONE, 
        help:'Force script to be injected even if the output is inconsistent'
    },{ 
        name:'src_file',  
        required:true,  
        data: ArgParser.STR, 
        help:'Path of the source file'
    },{ 
        name:'script',
        required:true, 
        data: ArgParser.STR, 
        help:'Script to inject in the file'
    }]))(process.argv);

if(Arguments == null){
    ps.exit(0);
}

// extend generic parsed args with plugin specific parsed args
Arguments.extendWith(spooferArgs);
var cmdOpts = Arguments.opts;

// Check if plugin selected, if there is no plugin selected and there is only one in the plugin directory
// it is selected 
if(cmdOpts.format == null){
    if(plugins.length == 1)
        cmdOpts.format = plugins[0];
    else{
        console.log(cmdOpts.help);
        ps.exit(0);
    }        
}


// if selected plugin has prepareInput() function, call it  
let data_src = null;
if(spoofer.prepareInput != undefined)
    data_src = spoofer.prepareInput(cmdOpts.src_file);
else
    data_src = cmdOpts.src_file; 

// perform pack
spoofer.perform(cmdOpts.src_file, cmdOpts);
/*
fs.readFile(cmdOpts.src_file, (err, data)=>{
    if(err) throw err;
       
    // perform mutation
    console.log("[*] File mutating ... \n");   
    let newData = spoofer.perform(data, cmdOpts);

    // create file
    fs.open(cmdOpts.out_file,'w+', (err, fd)=>{
        fs.write(fd, newData, 0, newData.length, 0, (err, written, buffer)=>{
            if(err) throw err;

            console.log("\n[*] File mutated : "+cmdOpts.out_file);
        
            fs.close(fd,(err)=>{ ps.exit(0) });
        });
    });
});
*/
