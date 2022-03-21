~function(){
var impls = arguments;
var idIndex = [].pop.call(impls);
var cached = {};
var previous_require = this.require;
function internal_require(i){
if(typeof i=='number'){
var module = cached[i];
if(!module){
var id = "./"+i;
module = cached[i] = {exports:{},id:id};
impls[i](module.exports,internal_require,module,id);
}
return module.exports;
}else{
return require(i) ;
}
}
function external_require(path){
var id = typeof path == 'number'?path:idIndex.indexOf(path);
if(id>=0){
return internal_require(id);
}else{
return external_require;
}
}
if(previous_require && previous_require.backup){
previous_require.backup.push(external_require)
}else{
this.require = function(pc){
if(pc instanceof Function){
var list = arguments;
var i = list.length;
var o = {};
while(--i){
copy(require(list[i]),o);
}
pc(o);
return o;
}else{
var list = require.backup;
var i = list.length;
while(i--){
var exports = list[i](pc);
if(exports != list[i]){
return exports
}
}
return previous_require?previous_require.apply(this,arguments):{}
}
}
this.require.backup = [external_require];
}
function copy(src,dest){
for(var n in src){
dest[n] = src[n];
}
}
copy(internal_require(0),this);
}(function(exports,require){
var ResultContext=require(6).ResultContext;
var URI=require(7).URI;
var defaultBase = new URI("lite:///");
var loadLiteXML=require(8).loadLiteXML;
var buildTopChain=require(9).buildTopChain;
var ExtensionParser=require(10).ExtensionParser;
var Extension=require(11).Extension;
var parseDefaultXMLNode=require(12).parseDefaultXMLNode;
var parseText=require(13).parseText;
var XA_TYPE=require(14).XA_TYPE;
var EL_TYPE=require(14).EL_TYPE;
var XT_TYPE=require(14).XT_TYPE;
var ParseConfig=require(15).ParseConfig;
exports.ParseContext=ParseContext;

function ParseContext(config,path){
config = config || new ParseConfig();
this.config = config;
this.currentURI = defaultBase;
this.configMap = config.getConfig(path);
this.textType=0;
this._path = path;
this._attributeMap = [[],[],{}]
this._result = new ResultContext();
this._context = this;
this._result._context = this;
this._resources = [];
initializeParser(this,config.getExtensionMap(path));
}

function initializeParser(context,extensionMap){
var extensionParser = new ExtensionParser();

for(var ns in extensionMap){
var exts = extensionMap[ns];
for(var len = exts.length,i=0;i<len;i++){
extensionParser.addExtension(ns,exts[i])
}
}
context._nodeParsers = [parseTextLeaf,parseDefaultXMLNode,parseExtension];
context._textParsers = [extensionParser];
context._extensionParser = extensionParser;
context._topChain = buildTopChain(context);
}
function parseExtension(node,context,chain){
return context._extensionParser.parse(node,context,chain);
}
function parseTextLeaf(text,context){
if(typeof text == 'string'){
return parseText(text,context,context._textParsers)
}else{
console.error("未知节点类型",typeof text,text)

}
}
ParseContext.prototype = {
parseText:function(source, textType) {
switch(textType){
case XA_TYPE :
case XT_TYPE :
case EL_TYPE :
break;
default:
console.error("未知编码模式："+textType)
throw new Error();
}
var mark = this.mark();
var oldType = this.textType;
this._context.textType = textType;
parseTextLeaf(source,this);
this._context.textType = oldType;
var result = this.reset(mark);
return result;
},

parse:function(source) {
var type = source.nodeType;
if(type>0){

this._topChain.next(source);
}else{
if(source instanceof URI){
var oldURI = this.currentURI;
this.setCurrentURI(source);

source = this.loadXML(source);
if(typeof source == 'string'){
source=source.replace(/#.*[\r\n]*/,'');
}
}
if(typeof source != 'string'){

var len = source.length;
var nodeType = source.nodeType;
if(nodeType === undefined && typeof source.item != 'undefined'){
if(len === 0){
return;
}
for(var i = 0;i<len;i++){
this._topChain.next(source.item(i));
}
return;
}
}
this._topChain.next(source);
if(oldURI) this.setCurrentURI(oldURI)
}
},
createURI:function(path) {

var base = this.config.root.toString();
if(!path){return path}
path = String(path);
if(path.indexOf(base) ==0){
path = path.substring(base.length-1);
}
var cu = this.currentURI;
if(cu){





return cu.resolve(path);

}else{
path= path.replace(/^[\\\/]/,'./');



return defaultBase.resolve(path);
}
},
loadText:function(uri){

if(uri.scheme == 'lite'){
var path = uri.path+(uri.query||'');
path = path.replace(/^\//,'./')
uri = this.config.root.resolve(path);
}
if(uri.scheme == 'file'){
var fs = require(4);
var path = uri.path;
if(fs.existsSync(path)){
return fs.readFileSync(path).toString()
}
}else{
var xhr = new XMLHttpRequest();
xhr.open("GET",uri,false)
xhr.send('');

return xhr.responseText;
}
},
loadXML:function(path){
var t1 = +new Date();
if(path instanceof URI){
}else{
if(/^\s*</.test(path)){
doc = loadLiteXML(path,this.config.root)
}else{
path = new URI(path)
}
}
if(path instanceof URI){
var doc = loadLiteXML(path,this.config.root);
this._context._loadTime+=(new Date()-t1);
}
var root = doc && doc.documentElement;
if(root){
root.setAttribute('xmlns:xhtml',"http://www.w3.org/1999/xhtml")
root.setAttribute('xmlns:c',"http://www.xidea.org/lite/core")
}
return doc;
},
setAttribute:function(key,value){
_setByKey(this._context._attributeMap,key,value)
},
getAttribute:function(key){
return _getByKey(this._context._attributeMap,key)
},
addNodeParser:function(np){
this._nodeParsers.push(np);
},
addTextParser:function(tp){
this._textParsers.push(tp);
},
addExtension:function(ns,pkg){
this._extensionParser.addExtension(ns,pkg);
},
getConfig:function(key){
return this.configMap[key];
},
getConfigMap:function(){
return this.configMap;
},
setCurrentURI:function(uri){
this._context.addResource(uri=new URI(uri));
this._context.currentURI = uri;
},
addResource:function(uri){
for(var rs = this._resources, i=0;i<rs.length;i++){
if(rs[i]+'' == uri){
return ;
}
}
this._resources.push(uri);
},
getResources:function(){
return this._resources;
},
createNew:function(){
var nc = new ParseContext(this.config,this.currentURI);
nc.config = this.config;
nc.configMap = this.configMap;
nc._resources = this._resources;
return nc;
},
_loadTime :0
}
var rm = ResultContext.prototype;
for(var n in rm){
if(rm[n] instanceof Function){
ParseContext.prototype[n] = buildResultWrapper(n);
}
}
function buildResultWrapper(n){
return function(){
var result = this._result;
return result[n].apply(result,arguments)
}
}
function _getByKey(map,key){
if(typeof key == 'string'){
map = map[2];
return key in map ? map[key]:null;
}
var keys = map[0];
var values = map[1];
var i = keys.length;
while(i--){
if(key === keys[i]){
return values[i];
}
}
}
function _setByKey(map,key,value){
if(typeof key == 'string'){
map[2][key] = value;
}else{
var keys = map[0];
var values = map[1];
var i = keys.length;
while(i--){
if(key === keys[i]){
values[i] = value;
if(value === undefined){
values.splice(i,1)
keys.splice(i,1)
}
return;
}
}
keys.push(key);
values.push(value);
}
}
}
,
function(exports,require){
var ELSE_TYPE=require(14).ELSE_TYPE;
var TranslateContext=require(16).TranslateContext;
var Expression=require(17).Expression;
var GLOBAL_DEF_MAP ={
"parseInt":1,	
"parseFloat":1,	
"encodeURIComponent":1,	
"decodeURIComponent":1,	
"encodeURI":1,	
"decodeURI":1,	
"isFinite":1,	
"isNaN":1
};
var GLOBAL_VAR_MAP ={
"JSON":1,
"Math":1
}
copy(GLOBAL_DEF_MAP,GLOBAL_VAR_MAP);

function JSTranslator(config){
this.config = config||{};
}

JSTranslator.prototype = {

translate:function(list,config){
config = config||{};
var params = config.params;
var functionName = config.name;
var ctx = new JSTranslateContext(list,functionName,params,config.defaults);
var translatorConfig = this.config || {};
var liteImpl = translatorConfig.liteImpl
ctx.waitPromise = translatorConfig.waitPromise && [[]];
ctx.hasBuildIn = !!liteImpl;
ctx.liteImpl = liteImpl && (typeof liteImpl == 'string'?liteImpl:'liteImpl');
ctx.parse();
var code = genSource(ctx);

try{
var fn = new Function('return '+code);

var scope = ctx.scope;
var refMap = scope.refMap;
var varMap = scope.varMap;
var externalRefs = Object.keys(refMap).filter(function(n){return !(n in varMap)})
if(externalRefs == 0 && params){
return 'function '+(functionName||'')+'(){return '+JSON.stringify(fn()()) + '}'
}

}catch(e){
var error = console.error("invalid code:",e,'<code>'+code+'</code>');
code = "return ("+JSON.stringify(error)+');';
}
return code.replace(/<\/script>/g,'<\\/script>').replace(/^\s*[\r\n]+/,'');
}
}
function genSource(ctx){
var header = ctx.header;
var body = ctx.body;
var functionName = ctx.name;
var params = ctx.params
var args = params?params.join(','):'__context__,__out__';
var result = ['function ',functionName,"(",args,'){\n',header,'\n']
if (ctx.waitPromise) {
result.push("\t__g__ = __g__();",
"function __n__(){",
"var n = __g__.next().value;",
"if(n instanceof Promise){",
"n.then(__n__);console.log('is promise',n)",



"}",
"};__n__();\n");
result.push('\tfunction* __g__(){\n',body,'\n\treturn __out__.join("");\n\t}\n}\n');
}else{
if(params){
var m = body.match(/^\s*__out__\.push\((.*?)\);?\s*$/)
if(m){
var item = '\treturn ['+m[1]+']'
try{
new Function(item)
if(item.indexOf(',')>0){
result.push(item,'.join("");\n}')
}else{
result.push('\treturn ',m[1],';\n}');
}
return result.join('');
}catch(e){}
}
result.push('\tvar __out__ = [];\n');
}else{
result.push('\tvar __out__ = __out__||[];\n');
}
result.push(body,'\n\treturn __out__.join("");\n}\n');
}
return result.join('');
}

function genDecFunction(contents,functionName,params,defaults,modelVarsDec){
var modelVarsDecAndParams = modelVarsDec.concat();

var args = params?params.join(','):'__context__';
if(params && defaults && defaults.length){

modelVarsDecAndParams.push('\tswitch(arguments.length){\n');
var begin = params.length - defaults.length
for(var i =0;i<params.length;i++){
modelVarsDecAndParams.push('\t	case ',i,':\n');
if(i>=begin){
modelVarsDecAndParams.push('\t	',params[i],'=',JSON.stringify(defaults[i-begin]),';\n');
}
}
modelVarsDecAndParams.push('\t}\n');
}

var source = contents.join('')
var SP = /^\s*\__out__\.push\((?:(.*)\)\s*;?)\s*$/g;
if(SP.test(source)){
var c =source.replace(SP,'$1');
if(c.indexOf(',')>0){

source = "\treturn ["+c+"].join('');";
}else{
source = "\treturn "+c+';';
}
}else{
source = "\tvar __out__=[]\n"+source.replace(/^\s*\n|\s*\n\s*$/g,'')+"\n\treturn __out__.join('');\n";
}
return 'function '+functionName+"("+args+'){\n'+modelVarsDecAndParams.join('')+source.replace(/^[\r\n]+/,'')+'\n}\n'
}
function genModelDecVars(ctx,scope,params){
var result = [];
var map = {};
var refMap = scope.externalRefMap;
var callMap = scope.callMap;
var varMap = scope.varMap;
var paramMap = scope.paramMap;

copy(refMap,map);

var vars = [];
for(var n in map){
if(n != '*' && !((n in GLOBAL_VAR_MAP)|| (n in varMap) || (n in paramMap))){
if(params){

}else{

result.push('\tvar ',n,'=("',n,'" in __context__?__context__:this)["',n,'"];\n');
vars.push(n);
}
}
}
if(!params && ctx.waitPromise){
result.push(vars.join('\n').replace(/.+/mg,'\tif($& instanceof Promise){$&.then(function(v){$& = v});}'),'\n');
}

return result;
}

function genBuildInSource(ctx){
if(ctx.hasBuildIn){return ''}
var buf = [''];
var c = ctx.xmlEncoder + ctx.entityEncoder*2;
if(c){
if(c>3){
ctx.optimizedEncoder = true;
buf.push("	function __x__(source,e){return String(source).replace(e||/&(?!#\\d+;|#x[\\da-f]+;|[a-z]+;)|[<\"]/ig,function(c){return '&#'+c.charCodeAt()+';'});}\n");
}else{
buf.push(" 	function __r__(c){return '&#'+c.charCodeAt()+';'}\n");
}
}
if(ctx.safeGetter){
buf.push('	function __get__(o,p,a){try{return a?o[p].apply(o,a):o[p]}catch(e){return e}}\n')
}

if(ctx.forStack.hit){

buf.push("	if(!Object.keys)Object.keys=function(o){var r=[];for(var n in o){r.push(n)};return r;};\n")
}
var df = ctx.dateFormat;
if(df.hit){
var dlstart = df.isFixLen?'__dl__(':''	
var dlend = df.isFixLen?',format.length)':''	
if(dlstart)	buf.push("	function __dl__(date,len){return len > 1? ('000'+date).slice(-len):date;}\n");
if(df.T)	buf.push("	function __tz__(offset){return offset?(offset>0?'-':offset*=-1,'+')+__dl__(offset/60,2)+':'+__dl__(offset%60,2):'Z'}\n");
if(df)	buf.push("	function __df__(pattern,date){\n");
if(df)	buf.push("		date = date?new Date(date):new Date();\n");
if(df)	buf.push("	        return pattern.replace(/",
df.qute?"'[^']+'|\"[^\"]+\"|":'',
"([YMDhms])\\1*",
df['.']?"|\\.s":'',
df.T?"|TZD$":'',
"/g,function(format){\n");
if(df)	buf.push("	            switch(format.charAt()){\n");
if(df.Y)	buf.push("	            case 'Y' :return ",dlstart,"date.getFullYear()",dlend,";\n");
if(df.M)	buf.push("	            case 'M' :return ",dlstart,"date.getMonth()+1",dlend,";\n");
if(df.D)	buf.push("	            case 'D' :return ",dlstart,"date.getDate()",dlend,";\n");
if(df.h)	buf.push("	            case 'h' :return ",dlstart,"date.getHours()",dlend,";\n");
if(df.m)	buf.push("	            case 'm' :return ",dlstart,"date.getMinutes()",dlend,";\n");
if(df.s)	buf.push("	            case 's' :return ",dlstart,"date.getSeconds()",dlend,";\n");
if(df['.'])	buf.push("	            case '.':return '.'+",dlstart,"date.getMilliseconds(),3);\n");
if(df.T)	buf.push("	            case 'T':return __tz__(date.getTimezoneOffset());\n");
if(df.qute)	buf.push("	            case '\'':case '\"':return format.slice(1,-1);\n");
if(df)	buf.push("	            default :return format;\n");
if(df)	buf.push("	            }\n");
if(df)	buf.push("	        });\n");
if(df)	buf.push("	    }\n");
}
return buf.join('');
}
function createDateFormat(ctx,pattern,date){
var df = ctx.dateFormat;
var patternSample=pattern[1];
var maxLen = 0;
if(pattern[0] != -1){
patternSample='YYMMDDhhmmss.sTZD';
}
patternSample.replace(/([YMDhms])\1*|\.s|TZD/g,function(c){
len = c.length;
c = c.charAt();
if(c == '"' || c== '\''){
df.qute = 1;
}
maxLen = Math.max(maxLen,df[c]=Math.max(df[c]||0,len));
})

df.isEL = df.isEL || date[0] != -2;
df.isFixLen = df.isFixLen || maxLen>1;
df.hit ++;
pattern = ctx.stringifyEL(pattern);
date = ctx.stringifyEL(date)
return {toString:function(){
return '__df__('+pattern+','+date+')';
}}
}
function JSTranslateContext(code,name,params,defaults){
TranslateContext.call(this,code,name,params,defaults);
this.forStack = [];
this.defaults = defaults;
this.xmlEncoder = 0;
this.entityEncoder=0;
this.dateFormat = {hit:0};
this.safeGetter = {hit:0}
}
JSTranslateContext.prototype = new TranslateContext();
JSTranslateContext.prototype.parse=function(){
var params = this.params;
this.out = [];

var defs = this.scope.defs;
var thiz = this;
var defVars = []

for(var i=0;i<defs.length;i++){
var def = this.scope.defMap[defs[i]];
this.outputIndent=1;
this.appendCode(def.code);
var vars = genModelDecVars(this,def,def.params);
var contents = thiz.reset();

defVars.push({
params:def.params,
defaults:def.defaults,
vars:vars,
name:def.name,
toString:function(){
var fn = genDecFunction(contents,this.name,def.params,def.defaults,[]);
return String(fn).replace(/^(.)/mg,'\t$1');
}});
}
try{
this.outputIndent=0;
this.outputIndent++;
this.appendCode(this.scope.code);
this.outputIndent--;
}catch(e){

throw e;
}





var headers = [];
var headers = genModelDecVars(this,this.scope,this.params);
var buildIn = genBuildInSource(this);
if(buildIn){
headers.unshift(buildIn);
}
this.header = headers.concat(defVars).join('');

this.body = this.reset().join('').replace(/^[\r\n]+/,'')
}
JSTranslateContext.prototype.appendStatic = function(item){
appendOutput(this,JSON.stringify(item));
}
JSTranslateContext.prototype.appendEL=function(item){
appendOutput(this,this.stringifyEL(item[1]))
}
JSTranslateContext.prototype.appendXT=function(item){
appendOutput(this,createXMLEncoder(this,item[1]))
}
JSTranslateContext.prototype.appendXA=function(item){

var el = item[1];
var value = this.stringifyEL(el);
var attributeName = item.length>2 && item[2];
if(attributeName){
var testId = this.allocateId(value);
if(testId != value){
el = new Expression(testId).token;
this.append("var ",testId,"=",value);
}
this.append("if(",testId,"!=null){");
this.pushBlock();
appendOutput(this,"' "+attributeName+"=\"'",createXMLEncoder(this,el,true),"'\"'");
this.popBlock();
this.append("}");
this.freeId(testId);
}else{
appendOutput(this,createXMLEncoder(this,el,true))
}
}
JSTranslateContext.prototype.appendVar=function(item){
this.append("var ",item[2],"=",this.stringifyEL(item[1]),";");
},
JSTranslateContext.prototype.appendEncodePlugin=function(item){
appendOutput(this,createEntityEncoder(this,item[1]));
},
JSTranslateContext.prototype.appendDatePlugin=function(pattern,date){
appendOutput(this,createDateFormat(this,pattern[1],date[1]))
}
JSTranslateContext.prototype.processCapture = function(item){
var childCode = item[1];
if(childCode.length == 1 && childCode[0].constructor == String){
item[1] = JSON.stringify(childCode[0]);
this.appendVar(item);
}else{
var varName = item[2];
var bufbak = this.allocateId();
this.append("var ",bufbak,"=__out__;__out__=[];");
this.appendCode(childCode);
this.append("var ",varName,"=__out__.join('');__out__=",bufbak,";");
this.freeId(bufbak);
}
},
JSTranslateContext.prototype.processIf=function(code,i){
var item = code[i];
var childCode = item[1];
var testEL = item[2];
var test = this.stringifyEL(testEL);


this.append('if(',test,'){');
this.pushBlock();
this.appendCode(childCode)
this.popBlock();
this.append("}");
var nextElse = code[i+1];
var notEnd = true;
this.pushBlock(true);
while(nextElse && nextElse[0] == ELSE_TYPE){
i++;
var childCode = nextElse[1];
var testEL = nextElse[2];
var test = this.stringifyEL(testEL);
if(test){
var wel = genWaitEL(this,testEL);
this.append('else if(',wel?'('+wel+')||('+test+')':test,'){');
}else{
notEnd = false;
this.append("else{");
}
this.pushBlock();
this.appendCode(childCode)
this.popBlock();
this.append("}");
nextElse = code[i+1];
}
this.popBlock(true);
return i;
}
JSTranslateContext.prototype.processFor=function(code,i){
this.forStack.hit = true;
var item = code[i];
var indexId = this.allocateId();
var lastIndexId = this.allocateId();
var itemsId = this.allocateId();
var itemsEL = this.stringifyEL(item[2]);
var varNameId = item[3]; 

var childCode = item[1];
var forInfo = this.findForStatus(item)

this.append("var ",itemsId,'=',itemsEL,';');
this.append("var ",indexId,"=0;")
this.append("var ",lastIndexId," = (",
itemsId,'=',itemsId,' instanceof Array?',itemsId,':Object.keys(',itemsId,')'
,").length-1;");

var forRef = forInfo.ref ;
var forAttr = forInfo.index || forInfo.lastIndex;
if(forRef){
var statusId = this.allocateId();
this.forStack.unshift([statusId,indexId,lastIndexId]);
this.append("var ",statusId," = {lastIndex:",lastIndexId,"};");
}else if(forAttr){
this.forStack.unshift(['for',indexId,lastIndexId]);
}
this.append("for(;",indexId,"<=",lastIndexId,";",indexId,"++){");
this.pushBlock();
if(forRef){
this.append(statusId,".index=",indexId,";");
}
this.append("var ",varNameId,"=",itemsId,"[",indexId,"];");
this.appendCode(childCode);
this.popBlock();
this.append("}");
var nextElse = code[i+1];
var notEnd = true;
var elseIndex = 0;
this.pushBlock(true);
while(notEnd && nextElse && nextElse[0] == ELSE_TYPE){
i++;
elseIndex++;
var childCode = nextElse[1];
var testEL = nextElse[2];
var test = this.stringifyEL(testEL);
var ifstart = elseIndex >1 ?'else if' :'if';
if(test){
var wel = genWaitEL(this,testEL);
this.append(ifstart,
'(',wel?'('+wel+')|| !':'!'
,indexId,'&&(',test,')){');
}else{
notEnd = false;
this.append(ifstart,"(!",indexId,"){");
}
this.pushBlock();
this.appendCode(childCode)
this.popBlock();
this.append("}");
nextElse = code[i+1];
}
this.popBlock(true);
if(forRef){
this.freeId(statusId);
this.forStack.shift();
}else if(forAttr){
this.forStack.shift();
}
this.freeId(lastIndexId);
this.freeId(itemsId);;
this.freeId(indexId);
return i;
}
JSTranslateContext.prototype.pushBlock = function(ignoreIndent){
if(!ignoreIndent){
this.outputIndent++
}
var waitPromise = this.waitPromise;
if(waitPromise){
var topStatus = waitPromise[waitPromise.length-1]
waitPromise.push(topStatus?topStatus.concat():[])
}
}
JSTranslateContext.prototype.popBlock = function(ignoreIndent){
if(!ignoreIndent){
this.outputIndent--;
}
if(this.waitPromise){
this.waitPromise.pop()
}
}
JSTranslateContext.prototype.appendModulePlugin = function(child,config){
if(this.waitPromise){
this.append('__out__.lazy(function* __lazy_widget_',config.id,'__(__out__){');
this.pushBlock();
this.appendCode(child)
this.popBlock();
this.append('})');
}else{
this.appendCode(child)
}
}
JSTranslateContext.prototype.stringifyEL= function (el){
return el?new Expression(el).toString(this):null;
};
JSTranslateContext.prototype.visitEL= function (el,type){
el = el && genWaitEL(this,el);
el && this.append(el);
};
JSTranslateContext.prototype.getVarName = function(name){
if(name == 'for'){
console.error('invalue getVarName:')

}
return name;
};
JSTranslateContext.prototype.getForName = function(){
var f = this.forStack[0];

return f && f[0];
};
JSTranslateContext.prototype.genGetCode = function(owner,property){

if(this.safeGetter){
this.safeGetter.hit = true;
return '__get__('+owner+','+property+')'
}else{

if(/^"[a-zA-Z_\$][_\$\w]*"$/.test(property)){
return owner+'.'+property.slice(1,-1);
}else{
return owner+'['+property+']';
}
}
};
JSTranslateContext.prototype.findForAttribute= function(forName,forAttribute){
var stack = this.forStack;
var index = forAttribute == 'index'?1:(forAttribute == 'lastIndex'?2:0);
for(var i=0;index && i<stack.length;i++){
var s = stack[i];
if(s && s[0] == forName){
return s[index];
}
}
}
function genWaitEL(ctx,el){
if(ctx.waitPromise){
var topWaitedVars = ctx.waitPromise[ctx.waitPromise.length-1];
if(topWaitedVars){
var vars = Object.keys(new Expression(el).getVarMap());
var vars2 = [];
for(var i=0;i<vars.length;i++){
var v = vars[i];
if(v != 'for' && topWaitedVars.indexOf(v)<0){
vars2.push(v)
topWaitedVars.push(v)
}
}
if (vars2.length) {
return 'yield* __out__.wait('+vars2.join(',')+')'
};
}
}
}
function appendOutput(ctx){
var outList = ctx.out;
var lastOutGroup = ctx._lastOutGroup;
var lastIndex = outList.length-1;
var args = outList.splice.call(arguments,1);
if(lastOutGroup && outList[lastIndex] === lastOutGroup){
lastOutGroup.list.push.apply(lastOutGroup.list,args)
}else{
ctx.append(ctx._lastOutGroup = new OutputGroup(args));
}
}
function OutputGroup(args){
this.list = args;
}
OutputGroup.prototype.toString = function(){
return '__out__.push(' + this.list.join(',')+');'
}
function createXMLEncoder(thiz,el,isAttr){
thiz.xmlEncoder ++;
el = thiz.stringifyEL(el);
return {toString:function(){
var e = (isAttr?'/[&<\\"]/g':'/[&<]/g');
if(thiz.optimizedEncoder||thiz.hasBuildIn){
return '__x__('+el+','+e+')';
}else{
return 'String('+el+').replace('+e+',__r__)'
}
}}
}
function createEntityEncoder(thiz,el){
el = thiz.stringifyEL(el);
thiz.entityEncoder ++;
return {
toString:function(){
if(thiz.optimizedEncoder || thiz.hasBuildIn){
return '__x__('+el+')';
}else{
return 'String('+el+').replace(/&(?!#\\d+;|#x[\\da-f]+;|[a-z]+;)|[<"]/ig,__r__)'
}
}}
}
function copy(source,target){
for(var n in source){
target[n] = source[n];
}
}
exports.JSTranslator=JSTranslator;
exports.GLOBAL_DEF_MAP=GLOBAL_DEF_MAP;
exports.GLOBAL_VAR_MAP=GLOBAL_VAR_MAP;
}
,
function(exports,require,module){function Template(code,config){

try{
this.impl = code instanceof Function?code:eval('['+code+'][0]');
}catch(e){

this.impl = function(){throw e;};
}
this.config = config;
this.contentType = config.contentType;
this.encoding = config.encoding;
}
Template.prototype.render = function(context,response){
try{
this.impl.call(null,context,wrapResponse(response));
}catch(e){
console.warn(this.impl+'');
var rtv = require(5).inspect(e,true)+'\n\n'+(e.message +e.stack);
response.end(rtv);
throw e;
}
}
function wrapResponse(resp){
var lazyList = [];
var buf=[];
var bufLen=0;
return {
push:function(){
for(var len = arguments.length, i = 0;i<len;i++){

var txt = arguments[i];
buf.push(txt)
if((bufLen+=txt)>1024){
resp.write(buf.join(''));
buf = [];
bufLen = 0;
}

}
},
join:function(){
resp.write(buf.join(''));
buf = [];
if(!doMutiLazyLoad(lazyList,resp)){
resp.end();
}
},
flush:function(){
resp.write(buf.join(''));
buf = [];
bufLen = 0;
},
wait:modelWait,
lazy:function(g){
lazyList.push(g);
}
}
}

try{
var modelWait = Function('return function* modelWait(){' +
'var i = arguments.length;while(i--){if (arguments[i] instanceof Promise) {' +
'this.flush();'+
'yield arguments[i]}}}')()
}catch(e){
console.error('es6 yield is not support!!');
var modelWait = function(){
return {done:true}
}
}
function doMutiLazyLoad(lazyList,resp){
var len = lazyList.length;
var dec = len;
var first = true;
for(var i = 0;i<len;i++){
startModule(lazyList[i],[]);
}

function startModule(g,r){
var id = g.name.replace(/^[^\d]+|[^\d]+$/g,'');
r.flush = function(){};
r.wait = modelWait;
g = g(r);
function next(){
var n = g.next();

if(n.done){

var rtv = r.join('');



resp.write('<script>'+
(first?'!this.__widget_loaded__&&(this.__widget_loaded__=function(id,h){document.querySelector(id).innerHTML=h});':'')
+'__widget_loaded__("*[data-lazy-widget-id=\''+id+'\']",'+JSON.stringify(rtv).replace(/<\/script>/ig,'<\\/script>')+')</script>')
first = false;
if(--dec == 0){

resp.end();
}
return rtv;
}else{
n.value.then(next);

}
}

next();
}
return len;
}
exports.wrapResponse = wrapResponse;
exports.Template = Template;
}
,
function(exports,require){if(typeof require == 'function'){
var XA_TYPE=require(14).XA_TYPE;
var ELSE_TYPE=require(14).ELSE_TYPE;
var EL_TYPE=require(14).EL_TYPE;
var XT_TYPE=require(14).XT_TYPE;
var TranslateContext=require(16).TranslateContext;
var getELType=require(18).getELType;
var TYPE_ANY=require(18).TYPE_ANY;
var TYPE_BOOLEAN=require(18).TYPE_BOOLEAN;
var TYPE_NULL=require(18).TYPE_NULL;
var TYPE_NUMBER=require(18).TYPE_NUMBER;
var GLOBAL_DEF_MAP=require(1).GLOBAL_DEF_MAP;
var GLOBAL_VAR_MAP=require(1).GLOBAL_VAR_MAP;
}

var FOR_STATUS_KEY = '$__for';
var VAR_LITE_TEMP="$__tmp";




function PHPTranslator(config){
this.waitPromise = config.waitPromise;

this.liteImpl = config.liteImpl||'lite__'
}
PHPTranslator.prototype = {

translate:function(list,config){

var context = new PHPTranslateContext(list||this.code,config.name);
context.waitPromise = this.waitPromise;
context.htmlspecialcharsEncoding = context.encoding = config.encoding ||"UTF-8";
context.contentType = config.contentType;

context.i18n = config.i18n

context.resources = config.resources;
context.parse();
var code = context.toSource();
return '<?php'+code ;
}
}
function PHPTranslateContext(code,id){
TranslateContext.call(this,code,null);
this.id = id;
}
function TCP(pt){
for(var n in pt){
this[n] = pt[n];
}
}
TCP.prototype = TranslateContext.prototype;
function toArgList(params,defaults){
if(params.length){
if(defaults && defaults.length){
params = params.concat();
var i = params.length;
var j = defaults.length;
while(j--){
params[--i] += '='+stringifyPHP(defaults[j]);
}
}
return '$'+params.join(',$')
}else{
return '';
}
}
function _stringifyPHPLineArgs(line){
var endrn="'";
line = line.replace(/['\\]|(\?>)|([\r\n]+$)|[\r\n]/gm,function(a,pend,lend){
if(lend){
endrn = '';
return "',"+JSON.stringify(a);
}else if(pend){
return "?','>";
}else{
if(a == '\\'){
return '\\\\';
}else if(a == "'"){
return "\\'";
}else{
console.error("非法输出行!!"+JSON.stringify(line));
}
return a == '\\'?'\\\\': "\\'";
}
});
line = "'"+line+endrn;
if("''," == line.substring(0,3)){
line = line.substring(3)
}
return line;
}
function _encodeEL(text,model,encoding){

if(model == -1){
var encode = "htmlspecialchars("+text+",ENT_COMPAT,"+encoding+",false)";

}else if(model == XA_TYPE){
var encode = "htmlspecialchars("+text+",ENT_COMPAT,"+encoding+')';
}else if(model == XT_TYPE){

var encode = "htmlspecialchars("+text+",ENT_NOQUOTES,"+encoding+')';
}else{
var encode = text;
}
return encode;
}
function _appendFunctionName(context,scope){
for(var n in scope.refMap){
if(!(n in scope.varMap || n in scope.paramMap)){
if(n in GLOBAL_DEF_MAP){
context.append('$',n,"='",n,"';");
}else if(n in GLOBAL_VAR_MAP){
}else{
context.append('$',n,"=function_exists('lite__",n,"')?'",n,"':null;");
}
}
}
}
PHPTranslateContext.prototype = new TCP({
stringifyEL:function (el){
return el?stringifyPHPEL(el,this):null;
},
parse:function(){
this.depth = 0;
this.out = [];

var defs = this.scope.defs;
for(var i=0;i<defs.length;i++){
var def = this.scope.defMap[defs[i]];
var n = def.name;
this.append("if(!function_exists('lite__",n,"')){function lite__",
n,"(",toArgList(def.params,def.defaults),'){')
this.depth++;
this.append("ob_start();");
_appendFunctionName(this,def);
this.appendCode(def.code);
this.append("$rtv= ob_get_contents();ob_end_clean();return $rtv;");
this.depth--;
this.append("}}");
}
try{
this.append("function lite_template",this.id,'($__context__){')
this.depth++;
if(this.contentType){
this.append("if(!headers_sent())header('ContentType:"+this.contentType+"');")
}
this.append("mb_internal_encoding('"+this.encoding+"');")
_appendFunctionName(this,this.scope);
this.append("extract($__context__,EXTR_OVERWRITE);");
if(this.i18n && this.resources){
var i18ncode = new Function("return "+this.i18n)();
var resources = this.resources;
var resourceMap = {};
var resourceList = [];
for(var i=0;i<resources.length;i++){
resourceMap[i18nHash(resources[i],'_').slice(0,-1)] = resources[i]
}
console.warn(resources,resourceMap)
for(var n in i18ncode){
n = n.substring(0,n.indexOf('__')+2);
if(n in resourceMap){
resourceList.push(n.slice(0,-2));
delete resourceMap[n];
}
}
this.append("$I18N = "+stringifyPHP(resourceList).replace(/^array/,'lite_i18n')+";")
this.append("$I18N = array_merge("+stringifyPHP(i18ncode)+",$I18N);")
}
this.appendCode(this.scope.code);
if(this.__lazy_module_){
this.append('lite_lazy_block($__lazy_module_);');
}
this.depth--;
this.append("}");
}catch(e){

console.error("PHP编译失败:"+this.id,e);
throw e;
}

},
appendStatic:function(value){

var lines = value.match(/.+[\r\n]*|[\r\n]+/g);
for(var i=0; i<lines.length; i++) {
var line = lines[i];
var start = i==0?'echo ':'\t,'
var end = i == lines.length-1?';':'';
line = _stringifyPHPLineArgs(line);
this.append(start,line,end);
}
},
_appendEL:function(el,model,text,prefix){
var encoding = "'"+this.htmlspecialcharsEncoding+"'";
prefix = prefix!=null? prefix : 'echo '

var text = text || this.stringifyEL(el);
var type = getELType(el);

if(isSimplePHPEL(text)){
var initText = text;
var tmpId = text;
}else{
tmpId = VAR_LITE_TEMP;
initText = '('+tmpId+'='+text+')';
}
if(type != TYPE_ANY){
if(type == TYPE_NULL){
this.append(prefix,"'null';");
return;
}else if(type == TYPE_BOOLEAN){
this.append(prefix,text,"?'true':'false';");
return;
}else if(type == TYPE_NUMBER){
this.append(prefix,text,";");
return;
}

if((TYPE_NULL|TYPE_BOOLEAN)==type){
this.append(prefix,initText,"?'true':(",tmpId,"===null?'null':'false');");
return;
}else if(!((TYPE_NULL|TYPE_BOOLEAN) & type)){
this.append(prefix,_encodeEL(text,model,encoding),";");
return;
}

if(!(type & TYPE_NULL)){
this.append(prefix,
initText," === true?'true':",
"(",tmpId,"===false?'false':",_encodeEL(tmpId,model,encoding),");");
return ;
}else if(!(type & TYPE_BOOLEAN)){
this.append(prefix,
initText,"===null?'null':",_encodeEL(tmpId,model,encoding),";");
return ;
}
}




this.append(prefix,'(',initText,'===null||',tmpId,'===false || ',tmpId,'===true)?json_encode(',tmpId,'):',_encodeEL(tmpId,model,encoding),';')
},
appendEL:function(item){
this._appendEL(item[1],EL_TYPE)
},
appendXT:function(item){
this._appendEL(item[1],XT_TYPE)
},
appendXA:function(item){

var el = item[1];
var value = this.stringifyEL(el);
var attributeName = item.length>2 && item[2];
var testAutoId = this.allocateId(value);
if(testAutoId != value){
this.append(testAutoId,"=",value,';');
}
if(attributeName){
this.append("if(",testAutoId,"!=null){");
this.depth++;
this.append("echo ' "+attributeName+"=\"';");
this._appendEL(el,XA_TYPE,testAutoId)
this.append("echo '\"';");
this.depth--;
this.append("}");
}else{
this._appendEL(el,XA_TYPE,testAutoId);
}
this.freeId(testAutoId);
},
appendVar:function(item){
this.append("$",item[2],"=",this.stringifyEL(item[1]),";");
},
processCapture:function(item){
var childCode = item[1];
var varName = item[2];
this.append("ob_start();");
this.appendCode(childCode);
this.append("$",varName,"= ob_get_contents();ob_end_clean();");
},
appendEncodePlugin:function(item){
this._appendEL(item[1],-1,this.stringifyEL(item[1]));
},
appendDatePlugin:function(pattern,date){

var pattern = this.stringifyEL(pattern[1]);
var date = this.stringifyEL(date[1]);
if(/^(?:'[^']+'|"[^"]+")$/.test(pattern)){
date = date + ',true';
}
this.append('echo lite__2(',pattern,',',date,');')
},
appendModulePlugin:function(child,config){
if(this.waitPromise){
this.append("ob_start();");

this.outputIndent++;
this.appendCode(child)
this.outputIndent--;

if(this.__lazy_module_){
this.append('array_push($__lazy_module_,'+config.id+');');
this.append('array_push($__lazy_module_,ob_get_contents());');
}else{
this.append('$__lazy_module_=array('+config.id+',ob_get_contents());')
}
this.append('ob_end_clean();');
this.__lazy_module_ = true;
}else{
this.appendCode(child)
}
},
processIf:function(code,i){
var item = code[i];
var childCode = item[1];
var testEL = item[2];
var test = this.stringifyEL(testEL);
this.append("if(",php2jsBoolean(testEL,test),"){");
this.depth++;
this.appendCode(childCode)
this.depth--;
this.append("}");
var nextElse = code[i+1];
var notEnd = true;
while(nextElse && nextElse[0] == ELSE_TYPE){
i++;
var childCode = nextElse[1];
var testEL = nextElse[2];
var test = this.stringifyEL(testEL);
if(test){
this.append("else if(",php2jsBoolean(testEL,test),"){");
}else{
notEnd = false;
this.append("else{");
}
this.depth++;
this.appendCode(childCode)
this.depth--;
this.append("}");
nextElse = code[i+1];
}
return i;
},
processFor:function(code,i){
var item = code[i];
var indexAutoId = this.allocateId();
var keyAutoId = this.allocateId();
var isKeyAutoId = this.allocateId();
var itemsEL = this.stringifyEL(item[2]);
var varName = '$'+item[3]; 

var childCode = item[1];
var forInfo = this.findForStatus(item)
if(forInfo.depth){
var preForAutoId = this.allocateId();
}
if(/^\$[\w_]+$/.test(itemsEL)){
var itemsAutoId = itemsEL;
}else{
var itemsAutoId = this.allocateId();
this.append(itemsAutoId,'=',itemsEL,';');
}

this.append('if(',itemsAutoId,'<=PHP_INT_MAX){',itemsAutoId,'=',itemsAutoId,'>0?range(1,',itemsAutoId,'):array();}');

var needForStatus = forInfo.ref || forInfo.index || forInfo.lastIndex;
if(needForStatus){
if(forInfo.depth){
this.append(preForAutoId ,"=",FOR_STATUS_KEY,";");
}
this.append(FOR_STATUS_KEY," = array('lastIndex'=>count(",itemsAutoId,")-1);");
}
this.append(indexAutoId,"=-1;")
this.append(isKeyAutoId,'=false;')
this.append("foreach(",itemsAutoId," as ",keyAutoId,"=>",varName,"){");
this.depth++;
this.append("if(++",indexAutoId," === 0){");
this.depth++;
this.append(isKeyAutoId,"=",keyAutoId," !== 0;");
this.depth--;
this.append("}");
this.append("if(",isKeyAutoId,"){",varName,'=',keyAutoId,";}");
if(needForStatus){
this.append(FOR_STATUS_KEY,"['index']=",indexAutoId,";");
}
this.appendCode(childCode);
this.depth--;
this.append("}");
if(needForStatus && forInfo.depth){
this.append(FOR_STATUS_KEY,"=",preForAutoId,';');
}
this.freeId(isKeyAutoId);
this.freeId(keyAutoId);
this.freeId(itemsAutoId);
if(forInfo.depth){
this.freeId(preForAutoId);
}
var nextElse = code[i+1];
var notEnd = true;
var elseIndex = 0;
while(notEnd && nextElse && nextElse[0] == ELSE_TYPE){
i++;
elseIndex++;
var childCode = nextElse[1];
var testEL = nextElse[2];
var test = this.stringifyEL(testEL);
var ifstart = elseIndex >1 ?'else if' :'if';
if(test){
this.append(ifstart,"(",indexAutoId,"<0&&",php2jsBoolean(testEL,test),"){");
}else{
notEnd = false;
this.append(ifstart,"(",indexAutoId,"<0){");
}
this.depth++;
this.appendCode(childCode)
this.depth--;
this.append("}");
nextElse = code[i+1];
}
this.freeId(indexAutoId);
return i;
},
toSource:function(){
return this.out.join('');
}
});
if(typeof require == 'function'){
exports.PHPTranslator=PHPTranslator;
var php2jsBoolean=require(19).php2jsBoolean;
var isSimplePHPEL=require(19).isSimplePHPEL;
var stringifyPHP=require(19).stringifyPHP;
var stringifyPHPEL=require(19).stringifyPHPEL;
var i18nHash=require(20).i18nHash;
}
}
,
function(exports,require,module){console.log("read module err!!!fs\nError: ENOENT: no such file or directory, open 'fs'")
}
,
function(exports,require,module){console.log("read module err!!!util\nError: ENOENT: no such file or directory, open 'util'")
}
,
function(exports,require){


function ResultContext(){
this.result = [];
}
function checkVar(v){
var exp = /^(break|case|catch|const|continue|default|do|else|false|finally|for|function|if|in|instanceof|new|null|return|switch|this|throw|true|try|var|void|while|with)$|^[a-zA-Z_][\w_]*$/;
var match = v.match(exp);
if(v == null || !match || match[1]!=null){
throw new Error("无效变量名：Lite有效变量名为(不包括括弧中的保留字)："+exp+"\n当前变量名为："+v);
}
return v;
}
ResultContext.prototype = {

parseEL : function(el){
try{
new Function("return ("+el.replace(/\bfor\b/g,"f")+')');
return new Expression(el).token;
}catch(e){
console.info("表达式解析失败[fileName:"+this._context.currentURI+"]",el,e.message)
throw new Error();
}
},

appendText:function( text){
for(var len = arguments.length,i=0;i<len;i++){
this.result.push(String(arguments[i]));
}

},

appendAll:function(ins){
for(var len = ins.length,i=0;i<len;i++){
this.result.push(ins[i]);
}
},

appendEL:function( el){
this.result.push([EL_TYPE, requireEL(this,el)]);
},

appendXA:function(attributeName, el){
this.result.push([XA_TYPE, requireEL(this,el), attributeName ]);
},

appendXT:function(el){
this.result.push([XT_TYPE, requireEL(this,el)]);
},

appendIf:function(testEL){
this.result.push([IF_TYPE, requireEL(this,testEL) ]);
},

appendElse:function(testEL){
clearPreviousText(this.result);
this.result.push([ELSE_TYPE, testEL && requireEL(this,testEL) || null ]);
},
appendFor:function(varName, itemsEL, statusName){
this.result.push([FOR_TYPE,requireEL(this,itemsEL), varName ]);
if(statusName){
this.appendVar(checkVar(statusName) , this.parseEL('for'));
}
},
appendEnd:function(){
this.result.push([])
},
appendVar:function(varName, valueEL){
this.result.push([VAR_TYPE,requireEL(this,valueEL),checkVar(varName)]);
},
appendCapture:function(varName){
this.result.push([CAPTURE_TYPE,checkVar(varName)]);
},
appendPlugin:function(clazz, config){
if(typeof config == 'string'){
config = JSON.parse(config);
}
config['class'] = clazz;
this.result.push([PLUGIN_TYPE,config]);
},
allocateId:function(){
if(this.inc){
this.inc++;
}else{
this.inc = 1;
}
return 'gid_'+this.inc.toString(32);
},
mark:function(){
return this.result.length;
},
reset:function(mark){
return optimizeResult(this.result.splice(mark,this.result.length));
},
toList:function(){
if(!this.optimized){
var result = optimizeResult(this.result);
var defMap = {};
var pureCode = buildTreeResult(result,defMap);
this.optimized = doOptimize(defMap,pureCode);
}
return this.optimized;
}
}
function requireEL(context,el){
if(typeof el == 'string'){
el = context.parseEL(el);
}
return el;
}

function clearPreviousText(result){
var i = result.length;
while(i--){
var item = result[i];
if(typeof item == 'string'){
result.pop();
}else{
break;
}
}
}
if(typeof require == 'function'){
exports.ResultContext=ResultContext;
var Expression=require(17).Expression;
var PLUGIN_TYPE=require(14).PLUGIN_TYPE;
var buildTreeResult=require(21).buildTreeResult;
var optimizeResult=require(21).optimizeResult;
var doOptimize=require(21).doOptimize;
var VAR_TYPE=require(14).VAR_TYPE;
var XA_TYPE=require(14).XA_TYPE;
var ELSE_TYPE=require(14).ELSE_TYPE;
var PLUGIN_TYPE=require(14).PLUGIN_TYPE;
var CAPTURE_TYPE=require(14).CAPTURE_TYPE;
var IF_TYPE=require(14).IF_TYPE;
var EL_TYPE=require(14).EL_TYPE;
var XT_TYPE=require(14).XT_TYPE;
var FOR_TYPE=require(14).FOR_TYPE;
}
}
,
function(exports,require){
var uriPattern = /^([a-zA-Z][\w\.]*)\:(?:(\/\/[^\/]*))?(\/?[^?#]*)(\?[^#]*)?(#[\s\S]*)?$/;
var absURIPattern = /^[a-zA-Z][\w\.]*\:/;
var uriChars = /\\|[\x22\x3c\x3e\x5c\x5e\x60\u1680\u180e\u202f\u205f\u3000]|[\x00-\x20]|[\x7b-\x7d]|[\x7f-\xa0]|[\u2000-\u200b]|[\u2028-\u2029]/g;
var allEncodes = /[\x2f\x60]|[\x00-\x29]|[\x2b-\x2c]|[\x3a-\x40]|[\x5b-\x5e]|[\x7b-\uffff]/g;

function encodeChar(i){
return "%"+(0x100+i).toString(16).substring(1)
}
function decodeChar(c){
var n = c.charCodeAt();
if (n < 0x80){
return encodeChar(n);
}else if (n < 0x800){
return encodeChar(0xc0 | (n >>> 6))+encodeChar(0x80 | (n & 0x3f))
}else{
return encodeChar( 0xe0 | ((n >>> 12) & 0x0f))+
encodeChar(0x80 | ((n >>> 6) & 0x3f))+
encodeChar(0x80 | (n & 0x3f))
}
}
function uriDecode(source){

for(var result = [], i=1;i<source.length;i+=3){
var c = parseInt(source.substr(i,2),16);
if(c>=240){
c = (c & 0x07)<<18;
c += (parseInt(source.substr(i+=3,2),16) &0x3f)<<12;
c += (parseInt(source.substr(i+=3,2),16) &0x3f)<<6;
c += (parseInt(source.substr(i+=3,2),16) &0x3f);
}else if(c>=224){
c = (c & 0x0f)<<12;
c += (parseInt(source.substr(i+=3,2),16) &0x3f)<<6;
c += (parseInt(source.substr(i+=3,2),16) &0x3f);
}else if(c>=192){
c = (c & 0x1f)<<6;
c += (parseInt(source.substr(i+=3,2),16) &0x3f);
}
result.push(String.fromCharCode(c))
}
return result.join('');
}
function uriReplace(c){
if(c == '\\'){
return '/';
}else{
return decodeChar(c);
}
}
function URI(path){
if(path instanceof URI){
return path;
}
if(/^\s*[<]/i.test(path)){
path = String(path).replace(uriChars,decodeChar)
return new URI("data:text/xml,"+path);
}else{
path = String(path).replace(uriChars,uriReplace)
}

path = path.replace(/\/\.\/|\\\.\\|\\/g,'/');
if(/^\/|^[a-z]\:\//i.test(path)){
path = 'file://'+path;
}
while(path != (path = path.replace(/[^\/]+\/\.\.\//g,'')));
var match = path.match(uriPattern);
if(match){
setupURI(this,match);
}else{
console.error("url must be absolute,"+path)
}
}
function setupURI(uri,match){
uri.value = match[0];
uri.scheme = match[1];
uri.authority = match[2];
uri.path = match[3];
uri.query = match[4];
uri.fragment = match[5];
if('data' == uri.scheme){
match = uri.value
uri.source = decodeURIComponent(match.substring(match.indexOf(',')+1));
}
}
URI.prototype = {
resolve:function(path){
path = String(path);
if( /^\s*[#<]/.test(path) ||absURIPattern.test(path)){
path = new URI(path.replace(/^\s+/,''));
return path;
}
path = path.replace(uriChars,uriReplace)
if(path.charAt() != '/'){
var p = this.path;
path = p.replace(/[^\/]*$/,path);
}
return new URI(this.scheme + ':'+(this.authority||'') + path);
},
toString:function(){
return this.value;
}
}
var btoa = this.btoa || function(bs){
var b64 = [];
var bi = 0;
var len = bs.length;
while (bi <len) {
var b0 = bs.charCodeAt(bi++);
var b1 = bs.charCodeAt(bi++);
var b2 = bs.charCodeAt(bi++);
var data = (b0 << 16) + (b1 << 8) + (b2||0);
b64.push(
b64codes[(data >> 18) & 0x3F ],
b64codes[(data >> 12) & 0x3F],
b64codes[isNaN(b1) ? 64 : (data >> 6) & 0x3F],
b64codes[isNaN(b2) ? 64 : data & 0x3F]) ;
}
return b64.join('');
}
var b64codes = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='.split('');
function utf8Replacer(c){
var n = c.charCodeAt();
if (n < 0x800){
return String.fromCharCode(
(0xc0 | (n >>> 6)),
(0x80|(n & 0x3f)));
}else{
return String.fromCharCode(
(0xe0 | ((n >>> 12) & 0x0f)),
(0x80 | ((n >>> 6) & 0x3f)),
(0x80 | (n & 0x3f)));
}
}
function base64Encode(data){
data = data && data.replace(/[\u0080-\uFFFF]/g,utf8Replacer)||''
data = btoa(data) ;
return encodeURIComponent(data);
}
function buildURIMatcher(pattern){
var matcher = /\*+|[^\*\\\/]+?|[\\\/]/g;
var buf = ["^"];
var m
matcher.lastIndex = 0;
while (m = matcher.exec(pattern)) {
var item = m[0];
var len = item.length;
var c = item.charAt(0);
if (c == '*') {
if (len > 1) {
buf.push(".*");
} else {
buf.push("[^\\\\/]*");
}
} else if(len == 1 && c == '/' || c == '\\') {
buf.push("[\\\\/]");
}else{
buf.push(item.replace(/[^\w]/g,quteReqExp));
}
}
buf.push("$");
return buf.join('');
}
function quteReqExp(x){
switch(x){
case '.':
return '\\.';
case '\\':
return '\\\\';
default:
return '\\x'+(0x100 + x.charCodeAt()).toString(16).substring(1);
}
}
if(typeof require == 'function'){
exports.URI=URI;
exports.buildURIMatcher = buildURIMatcher;
exports.base64Encode=base64Encode;
}
}
,
function(exports,require){function loadLiteXML(uri,root){
try{
if(uri instanceof URI){ 
if(uri.source){
return parseXMLByText(uri.source.replace(/^[\s\ufeff]*/,uri))
}else if(uri.scheme == 'lite'){
var path = uri.path+(uri.query||'')+(uri.fragment || '');
path = root.resolve(path.replace(/^\//,'./'))+'';
}else{
var path = String(uri);
}
}else{
var path = String(uri);
}
if(/^[\s\ufeff]*[<#]/.test(path)){
return parseXMLByText(path.replace(/^[\s\ufeff]*/,''),root)
}else{

if(/^(?:\w+\:\/\/|\w\:\\|\/).*$/.test(path)){
var pos = path.indexOf('#')+1;
var xpath = pos && path.substr(pos);
var path = pos?path.substr(0,pos-1):path;
var source = loadTextByPath(path.replace(/^file\:\/\/?/,''));
var doc = parseXMLByText(source,uri);
if(xpath && doc.nodeType){
doc = selectByXPath(doc,xpath);
}
return doc;
}else{

return parseXMLByText(path);
}
}
}catch(e){
console.error("文档解析失败:"+uri,e)
throw e;
}
}
function txt2xml(source){
return "<out xmlns='http://www.xidea.org/lite/core'><![CDATA["+
source.replace(/^\ufeff?#.*[\r\n]*/, "").replace(/]]>/, "]]]]><![CDATA[>")+
"]]></out>";
}
function addInst(xml,s){
var p = /^\s*<\?(\w+)\s+(.*)\?>/;
var m;
var first = xml.firstChild;
while(m = s.match(p)){
if(m[1] == 'xml'){
var pi = xml.createProcessingInstruction(m[1], m[2]);
xml.insertBefore(pi, first);
}
s = s.substring(m[0].length);
}
return xml;
}

function parseXMLByText(text,path){
if(!/^[\s\ufeff]*</.test(text)){
text = txt2xml(text);
}
try{
var doc = new DOMParser({locator:{systemId:path},
xmlns:defaultNSMap
}).parseFromString(text,"text/html")
if(!doc.querySelectorAll){
var elp = doc.documentElement.constructor.prototype;
elp.querySelector = querySelector;
elp.querySelectorAll = querySelectorAll;
elp = doc.constructor.prototype;
elp.querySelector = querySelector;
elp.querySelectorAll = querySelectorAll;
}
return addInst(doc,text);
}catch(e){
console.error("解析xml失败:",e,text);
}
}
function loadTextByPath(path){
var fs = require(4);
try{
var text = fs.readFileSync(path,'utf-8');
}catch(e){
return fs.readFileSync(decodeURI(path),'utf-8');
}
return text;
}
function selectorInit(node){
var doc = node.ownerDocument||node;
var nw = doc.nwmatcher;
if(!nw){
nw = doc.nwmatcher = nwmatcher({document:doc});
nw.configure( { USE_QSAPI: false, VERBOSITY: true } );
}
return nw;
}
function querySelectorAll(selector){
var nodes = selectorInit(this).select(selector,this);
nodes.item = nodeListItem;
return nodes;
}
function querySelector(selector){
return selectorInit(this).first(selector,this)
}
function selectByXPath(currentNode,xpath){
var nodes = xpathSelectNodes(currentNode,xpath);
nodes.item = nodeListItem;
return nodes;
}
function nodeListItem(i){
return this[i];
}
function findXMLAttribute(el,key){
if(el.nodeType == 2){
return el.value;
}
try{

var required = key.charAt() == '*';
if(required){
key = key.substr(1);
}
for(var i=1,len = arguments.length;i<len;i++){
var an = arguments[i];
if(an == '#text'){
return el.textContent||el.text;
}else{
var v = el.getAttribute(an);
if(v || (typeof el.hasAttribute != 'undefined') && el.hasAttribute(an)){
if(i>1 && key.charAt(0) != '#'){
console.warn(el.tagName+" 标准属性名为："+key +'; 您采用的是：'+an);
}
return v;
}
}
}
if(required){
console.error("标记："+el.tagName+"属性：'"+key +"' 为必要属性。");
}
}catch(e){
console.error('findXMLAttribute error:',e)
}
return null;
}
function findXMLAttributeAsEL(el){
el = findXMLAttribute.apply(null,arguments);
if(el !== null){
var el2 = el.replace(/^\s*\$\{([\s\S]*)\}\s*$/,"$1")
if(el == el2){
if(el2){
console.warn("缺少表达式括弧,文本将直接按表达式返回",el);
}
}else{
el2 = el2.replace(/^\s+|\s+$/g,'');
if(!el2){
console.warn("表达式内容为空:",el);
}
el = el2;
}
}
return el;
}
function getLiteTagInfo(node){
return node.lineNumber + ','+ node.columnNumber+'@'+node.ownerDocument.documentURI;
}
var defaultNSMap = {c:'http://www.xidea.org/lite/core',h:'http://www.xidea.org/lite/html-ext'}
var nwmatcher = require(23);
var URI=require(7).URI;
var DOMParser = require(22).DOMParser;
var xpathSelectNodes = require(26);
exports.defaultNSMap = defaultNSMap;
exports.querySelector = querySelector;
exports.querySelectorAll = querySelectorAll;
exports.loadLiteXML=loadLiteXML;
exports.selectByXPath=selectByXPath;
exports.findXMLAttribute=findXMLAttribute;
exports.findXMLAttributeAsEL=findXMLAttributeAsEL;
exports.getLiteTagInfo = getLiteTagInfo;
}
,
function(exports,require){
exports.buildTopChain=buildTopChain;

function buildTopChain(context){
function TopChain(){
}
TopChain.prototype = context;
var pt = TopChain.prototype = new TopChain();
pt.index = context._nodeParsers.length;
pt.subIndex = -1;
pt.getSubChain = getSubChain;
pt.next = doNext;
pt.constructor = TopChain;
return new TopChain();
}
function doNext(node){

if (this.subIndex > 0) {
var next = this.getSubChain(this.subIndex - 1);
} else {
next = this.nextChain||buildNext(this,this.index-1);
}
doParse(node,next);
}
function doParse(node,chain){

var parser = chain._nodeParsers[chain.index];
if(parser == null){
console.error('解析栈异常',parser,chain.index,chain._nodeParsers);
}
parser(node,chain,chain);




}
function getSubChain(subIndex){
if (this.subChains == null) {
this.subChains =[];
}
var i = this.subChains.length;
for (;i <= subIndex; i++) {
var subChain = new this.constructor();
subChain.index = this.index

subChain.subIndex = i;
subChain.subChains = this.subChains;
this.subChains.push(subChain);
}
if (subChain == null) {
subChain = this.subChains[subIndex];
}
return subChain;
}
function buildNext(thiz,index){
if(index>=0){
var n = new thiz.constructor();
n.index = index
return thiz.nextChain = n;
}
return null;
}
}
,
function(exports,require){
var CORE_URI = "http://www.xidea.org/lite/core"
var HTML_EXT_URI = "http://www.xidea.org/lite/html-ext"
var HTML_URI = "http://www.w3.org/1999/xhtml"
var currentExtension;
var defaultNodeLocal={
get:function(){
return this.node
},
set:function(n){
this.node = n;
}
}
var nodeLocal = defaultNodeLocal;
var Extension=require(11).Extension;
var HTML=require(24).HTML;
var HTML_EXT=require(24).HTML_EXT;
var getLiteTagInfo=require(8).getLiteTagInfo;

var Core=require(25).Core;
exports.ExtensionParser=ExtensionParser;
copyTo(require(27),Core);
copyTo(require(20),Core);
copyTo(require(28),Core);
function copyTo(from,to){
for(var n in from){
to[n]=from[n];
}
}
function ExtensionParser(newNodeLocal){
if(newNodeLocal){
nodeLocal = newNodeLocal;
}else{
nodeLocal = defaultNodeLocal;
}
this.packageMap = {};
this.addExtension(CORE_URI,Core);
this.addExtension(HTML_URI,HTML)
this.addExtension(HTML_EXT_URI,HTML_EXT)
}
function formatName(el){
var tagName = el.localName|| el.nodeName ||''
tagName = tagName.replace(/[\-]|^\w+\:/g,"");
return tagName.toLowerCase();
}
function loadExtObject(source){
try{
var p = /\b(?:document|xmlns|(?:parse|intercept|seek)\w*)\b/g;
var fn = new Function("console","var window = this;"+source+"\n return function(){return eval(arguments[0])}");
var m,o;
var objectMap = {};
}catch(e){
console.error("扩展源码语法错误:",e,source)
throw e;
}
try{
fn = fn(console);
}catch(e){
console.error("扩展脚本装载失败：",source,e);
}
while(m = p.exec(source)){
try{
o = fn(m[0]);
if(o instanceof Function){
objectMap[m[0]] = o;
}
}catch(e){
}
}
return objectMap;
}
function findPatternParser(map,key){
var buf = [];
for(var n in map){
if(new RegExp('^'+n.replace(/\*/g,'.*')+'$').test(key)){
buf.push.apply(buf,map[n]);
}
}
return buf.length ? buf:null;
}
function copyParserMap(mapClazz,p,p2,key){
var map = p[key];
if(map){
var result = mapClazz.newInstance();
p2.put(key ,result);
for(var n in map){
result.put(n, map[n]);
}
}
}

ExtensionParser.prototype = {
mapJava:function(mapClazz){
var result = mapClazz.newInstance();
for(var n in this.packageMap){
var p = this.packageMap[n];
var p2 = mapClazz.newInstance();
result.put(n,p2);
if(p.namespaceParser){
p2.put('namespaceParser', p.namespaceParser);
}
copyParserMap(mapClazz,p,p2,"interceptMap")
copyParserMap(mapClazz,p,p2,"typeMap")
copyParserMap(mapClazz,p,p2,"tagMap")
copyParserMap(mapClazz,p,p2,"patternTagMap")
copyParserMap(mapClazz,p,p2,"attributeMap")
copyParserMap(mapClazz,p,p2,"patternAttributeMap")
copyParserMap(mapClazz,p,p2,"seekMap")
}
return result
},
parseElement:function(el, context,chain){

var ns = el.namespaceURI;
var attrs = el.attributes;
var len = attrs.length;
try{

for (var i = len- 1; i >= 0; i--) {
var attr = attrs.item(i);
var ans = attr.namespaceURI;
if(ans){
var ext = this.packageMap[ans];
var an = formatName(attr);

if (ext && ext.interceptMap) {
var fn = ext.interceptMap[an];
if(fn && an in ext.interceptMap){



fn.call(chain,attr);


return true;
}
}
}
}




}finally{
}
var ext = this.packageMap[ns||''];
var n = formatName(el);
if(ext && ext.tagMap){
if(n in ext.tagMap){
var fns = ext.tagMap[n];
return doParse(el,fns,chain);
}else if(fns = findPatternParser(ext.patternTagMap,n)){
return doParse(el,fns,chain);
}
}
},
parse:function(node,context,chain){


var type = node.nodeType;

if(type === 1){

var old = nodeLocal.get();

try{
nodeLocal.set(node);
if(this.parseElement(node,context,chain)){
return;
}
}finally{
nodeLocal.set(old);
}

}else if(type === 2){
if(this.parseAttribute(node,context,chain)){
return;
}
} else{
if(type == 9 || type == 8){
for(var ns in this.packageMap){

var p = this.packageMap[ns];
if(p && p.typeMap){
var fns = p.typeMap['$'+type];
if(fns){
return doParse(node,fns,chain,ns);
}
}
}
}
}

chain.next(node)



},
parseAttribute:function(node,context,chain){
if(this.parseNamespace(node,context,chain)){
return true;
}
try{

var el = node.ownerElement || node.selectSingleNode("..");

var ns = node.namespaceURI || el && el.namespaceURI||'';
var ext = this.packageMap[ns];
var n = formatName(node);
if(n == '__i' && ns == CORE_URI){
return true;
}

if(ext && ext.attributeMap){
if(n in ext.attributeMap){
return doParse(node,ext.attributeMap[n],chain);
}else{
var fns = findPatternParser(ext.patternAttributeMap,n);
if(fns){
return doParse(node,fns,chain);
}
}
}
}catch(e){
console.error("属性扩展解析异常：",e)
}
},
parseNamespace:function(attr,context,chain){
try{
var es = 0;
if(/^xmlns(?:\:\w+)?/.test(attr.name)){
var v = attr.value;
var fp = this.packageMap[v||''];
if(fp){
if(fp.namespaceParser){
fp.namespaceParser.call(chain,attr);
return true;
}
var el = attr.ownerElement || attr.selectSingleNode("..");
var info = getLiteTagInfo(el);
if(info && info.length ==0 || info.indexOf("|"+attr.name+"|")>0){
return fp!=null;
}else{
return true;
}
}

}
}catch(e){
console.error("名称空间解析异常：",es,e)
}
return false;
},
parseText:function(text,start,context){
var text2 = text.substring(start+1);
var match = text2.match(/^(?:(\w*)\:)?([\w!#]*)[\$\{]/);
try{

if(match){
var matchLength = match[0].length;
var node = nodeLocal.get();
var prefix = match[1];
var fn = match[2]
if(prefix == null){
var ns = ""
}else{

if(node && node.lookupNamespaceURI){
var ns = node.lookupNamespaceURI(prefix);
if (ns == null) {
var doc = node.ownerDocument;
ns = doc && doc.documentElement.lookupNamespaceURI(prefix);
}
}

}
if(!ns && (prefix == 'c' || !prefix)){
ns = CORE_URI
}
if(ns == null){
console.warn("文本解析时,查找名称空间失败,请检查是否缺少XML名称空间申明：[code:$"+match[0]+",prefix:"+prefix+",document:"+context.currentURI+"]")
}else{
var fp = this.packageMap[ns];
if(fp){

var text3 = text2.substring(matchLength-1);
var seekMap = fp.seekMap;
if(fn in seekMap){
fn = seekMap[fn];
var rtv = fn.call(context,text3);
if(rtv>0 || rtv === 0){
return start+matchLength+rtv+1
}
}else{
console.warn("文本解析时,找不到相关的解析函数,请检查模板源码,是否手误：[function:"+fn+",document:"+(context && context.currentURI)+"]")

}
}else{
console.warn("文本解析时,名称空间未注册实现程序,请检查lite.xml是否缺少语言扩展定义：[code:$"+match[0]+",namespace:"+ns+",prefix:"+prefix+",document:"+context.currentURI+"]")
}
}
}
}catch(e){
console.error("文本解析异常：",e)
}

return -1;
},

findStart:function(text,start,otherStart){
var begin = start;
while(true){
begin = text.indexOf('$',begin);
if(begin<0 || otherStart <= begin){
return -1;
}
var text2 = text.substring(begin+1);
var match = text2.match(/^(?:\w*\:)?[\w#!]*[\$\{]/);
if(match){
return begin;
}
begin++;
}
},
addExtension:function(namespace,packageName){
if(typeof packageName == 'string'){
if(/^[\w\.\/]+$/.test(packageName)){
var objectMap = {};
var packageObject = require(packageName);
for(var n in packageObject){
if(n.match(/^(?:document|xmlns|on|parse|intercept|seek).*/)){
objectMap[n] = packageObject[n];
}
}
}else{
objectMap = loadExtObject(packageName)
}
}else{
objectMap = packageName;
}
var ext = this.packageMap[namespace||''];
if(ext == null){
ext = this.packageMap[namespace||''] = new Extension();
}
ext.initialize(objectMap,namespace||'');
},
getPriority:function() {



return 2;
}
}
function doParse (node,fns,chain,ns){
var last = fns.length-1;
if(last>0){
var subIndex = chain.subIndex;
if(subIndex <0){
subIndex = last;
chain = chain.getSubChain(last);
}

fns[subIndex].call(chain,node,ns);
}else{



fns[0].call(chain,node,ns);
}
return true;
}
}
,
function(exports,require){
function Extension(){
this.namespaceParser = null;
this.interceptMap = null;
this.typeMap = null;
this.tagMap = null;
this.patternTagMap = null;
this.attributeMap = null;
this.patternAttributeMap = null;
this.seekMap = null;
}
function add(m,fn,o){
if(fn in m){
m[fn].push(o);
}else{
m[fn] = [o];
}
}
function appendParser(ext,key,patternKey,fn,o){
var m = ext[key];
if(fn.indexOf('*')>=0){
var pm = ext[patternKey];
if(!pm){
ext[patternKey] = pm = {};
}
add(pm,fn,o);

if(m){
var p = new RegExp('^'+fn.replace(/\*/g,'.*')+'$');
for(var n in m){
if(p.test(n)){
add(m,n,o);
}
}
}
}else{
if(!m){
ext[key] = m = {};
var pm = ext[patternKey];
if(pm){
for(var p in pm){
if(new RegExp('^'+p.replace(/\*/g,'.*')+'$').test(fn)){
add(m,fn,pm[p]);
}
}
}
}
add(m,fn,o);
}
}
Extension.prototype={
initialize:function(objectMap){

for(var key in objectMap){
var o = objectMap[key];

if(o instanceof Function){
var dest = null;
var match = key.match(/^(parse|seek|intercept|xmlns|on)(.*)/);
var prefix =match&& match[1];
var fn = match &&formatName(match[2]);
if(prefix == "parse"){
var c = fn.charAt(0);
fn = fn.replace(/^[12]/,'');
if( c == '$'){
if(!this.typeMap){
this.typeMap = {};
}
add(this.typeMap,fn,o);
}else{
appendParser(this,"tagMap","patternTagMap",fn,o);
}
}else if(prefix == "on"){
appendParser(this,"attributeMap","patternAttributeMap",fn,o);
}else if(prefix == "xmlns"){
this.namespaceParser = o;
}else if(prefix == "intercept"){
dest = this.interceptMap ||(this.interceptMap={});
dest[fn] = o;
}else if(prefix == "seek"){
dest = this.seekMap ||(this.seekMap={});
dest[fn] = o;
}
}
}
}
}
function formatName(tagName){
tagName = tagName.replace(/[\-]/g,"");
return tagName.toLowerCase();
}
if(typeof require == 'function'){
exports.Extension=Extension;
}
}
,
function(exports,require){



var XA_TYPE = require(14).XA_TYPE;
var EL_TYPE = require(14).EL_TYPE;
var XT_TYPE = require(14).XT_TYPE;
exports.parseDefaultXMLNode = parseDefaultXMLNode;
var XML_SPACE_TRIM =exports.XML_SPACE_TRIM = "http://www.xidea.org/lite/attribute/h:trim-space" 
function parseDefaultXMLNode(node,context,chain){

switch(node.nodeType){
case 1: 
processElement(node,context,chain)
break;
case 2: 
processAttribute(node,context,chain)
break;
case 3: 
processTextNode(node,context,chain)
break;
case 4: 
processCDATA(node,context,chain)
break;
case 5: 
processEntityReference(node,context,chain)
break;
case 6: 
processEntity(node,context,chain)
break;
case 7: 
processProcessingInstruction(node,context,chain)
break;
case 8: 
processComment(node,context,chain)
break;
case 9: 
case 11:
processDocument(node,context,chain)
break;
case 10:
processDocumentType(node,context,chain)


break;
case 12:
processNotation(node,context,chain);
break;
default:
chain.next(node);

}



}
var htmlLeaf = /^(?:meta|link|img|br|hr|input)$/i;
var htmlReserved = /^(?:script|style|pre|textarea)$/i
var scriptTag = /^script$/i
function processElement(node,context,chain){
var attributes = node.attributes;
var tagName = node.tagName;
context.appendText('<'+tagName);
for (var i=0; i<attributes.length; i++) {
try{

var attr = attributes.item(i);
}catch(e){
var attr =attributes[i];
}
context.parse(attr)
}
if(htmlLeaf.test(tagName)){
context.appendText('/>')
return ;
}
context.appendText('>')
var child = node.firstChild
if(child){



do{
context.parse(child)
}while(child = child.nextSibling)
}
context.appendText('</'+node.tagName+'>')
}

function processAttribute(node,context,chain){
var name = String(node.name);
var value = String(node.value);
var buf = context.parseText(value,XA_TYPE);
var isStatic;
var isDynamic;

var i = buf.length;
while(i--){

var value = buf[i];
if(value.constructor == String){
if(value){
isStatic = true;
}else{
buf.splice(i,1);
}
}else{
isDynamic = true;
}
}
if(isDynamic && !isStatic){


if(buf.length > 1){

throw new Error("属性内只能有单一EL表达式！！");
}else{
if(buf[0][0] == XA_TYPE){

context.appendXA(name,buf[0][1]);
return null;
}
}
}
context.appendText((/^on/.test(name)?'\n':' ')+name+'="');
if(/^xmlns$/i.test(name)){
if(buf[0] == 'http://www.xidea.org/lite/xhtml'){
buf[0] = 'http://www.w3.org/1999/xhtml'
}
}
context.appendAll(buf);
context.appendText('"');
}
function processTextNode(node,context,chain){
var data = String(node.data);

var space = context.getAttribute(XML_SPACE_TRIM);

if(space == true){
data = data.replace(/^\s*|\s*$|(\s)\s+/g,"$1");
}else if(space != false){
data = data.replace(/^\s*([\r\n])\s*|\s*([\r\n])\s*$|^(\s)+|(\s)+$/g,"$1$2$3$4");
}
context.appendAll(context.parseText(data,XT_TYPE))
}
function processCDATA(node,context,chain){
context.appendText("<![CDATA[");
context.appendAll(context.parseText(node.data,EL_TYPE));
context.appendText("]]>");
}
function processEntityReference(){
return null;
}
function processEntity(){
return null;
}
function processProcessingInstruction(node,context,chain){
context.appendText("<?"+node.nodeName+" "+node.data+"?>");
}
function processComment(){
return null;
}
function processDocument(node,context,chain){
for(var n = node.firstChild;n!=null;n = n.nextSibling){
context.parse(n);
}
}










function processDocumentType(node,context,chain){
if(node.xml){
context.appendText(node.xml);
}else{
var pubid = node.publicId;
var nodeName = node.nodeName;
var sysid = node.systemId;
if(sysid == '.'){sysid = null}
if(pubid){
if(pubid == "org.xidea.lite.OUTPUT_DTD"){
if(sysid){
context.appendText(decodeURIComponent(sysid));
}
return;
}
context.appendText('<!DOCTYPE ');
context.appendText(nodeName);
context.appendText(' PUBLIC "');
context.appendText(pubid);
if (sysid == null) {
context.appendText( '" "');
context.appendText(sysid);
}
context.appendText('">');
}else if(sysid){
context.appendText('<!DOCTYPE ');
context.appendText(nodeName);
context.appendText(' SYSTEM "');
context.appendText(sysid);
context.appendText('">');
}else{
context.appendText("<!DOCTYPE ");
context.appendText(nodeName);
var sub = node.internalSubset;
if(sub){
context.appendText(" [");
context.appendText(sub);
context.appendText("]");
}
context.appendText(">");
}
}
}

function processNotation(node,context,chain){
return null;
}

}
,
function(exports,require){
var XA_TYPE=require(14).XA_TYPE;
var EL_TYPE=require(14).EL_TYPE;
var XT_TYPE=require(14).XT_TYPE;
exports.parseText=parseText;

function parseText(text,context,textParsers){
switch(context.textType){
case XA_TYPE :
var qute = '"';
case XT_TYPE :
var encode = true; 
case EL_TYPE:
break;
default:
console.error("未知编码模式："+context.textType+text)
return;
}
var len = text.length;
var start = 0;
do {
var nip = null;
var p$ = len + 1;
{
var pri = 0;
var ti = textParsers.length;
while (ti--) {
var ip = textParsers[ti];
var p$2 = ip.findStart(text, start, p$);
var pri2 = ip.priority || 1;
if (p$2 >= start ){
if(p$2 < p$ || p$2 == p$ && pri2>pri){
p$ = p$2;
nip = ip;
pri = pri2;
}
}
}
}
if (nip != null) {
var escapeCount = countEescape(text, p$);
appendText(context,
text.substring(start, p$ - ((escapeCount + 1) >>1)),
encode,	qute);
if ((escapeCount & 1) == 1) {
start = nextPosition(context, text, p$);
} else {
start = p$;
var mark = context.mark();
try {
start = nip.parseText(text, start, context);
} catch (e) {
console.warn("尝试表达式解析失败:[source:"+text+",fileName:"+context.currentURI+"]",e);
}
if (start <= p$) {
context.reset(mark);
start = nextPosition(context, text, p$);
}
}
} else {
break;
}
} while (start < len);
if (start < len) {
appendText(context,text.substring(start), encode, qute);
}
}

function appendText(context,text, encode, escapeQute){
if(encode){
if(escapeQute == '"'){
var replaceExp = /[<&"]/g;
}else if(escapeQute == '\''){
var replaceExp = /[<&']/g;
}else{
var replaceExp = /[<&]/g;
}
text = text.replace(replaceExp,xmlReplacer);
}
context.appendText(text);
}
function xmlReplacer(c){
switch(c){
case '<':
return '&lt;';
case '>':
return '&gt;';
case '&':
return '&amp;';
case "'":
return '&#39;';
case '"':
return '&#34;';
}
}
function nextPosition(context, text, p$) {
context.appendText(text.substring(p$, p$ + 1));
return p$ + 1;
}
function countEescape(text, p$) {
if (p$ > 0 && text.charAt(p$ - 1) == '\\') {
var pre = p$ - 1;
while (pre-- > 0 && text.charAt(pre) == '\\')
;
return p$ - pre - 1;
}
return 0;
}
}
,
function(exports,require){
var EL_TYPE = 0;
var IF_TYPE = 1;
var BREAK_TYPE = 2;
var XA_TYPE = 3;
var XT_TYPE = 4;
var FOR_TYPE = 5;
var ELSE_TYPE = 6;
var PLUGIN_TYPE =7;
var VAR_TYPE = 8;
var CAPTURE_TYPE = 9;
var IF_KEY = "if";
var FOR_KEY = "for";
var PLUGIN_DEFINE = "org.xidea.lite.DefinePlugin";
exports.PLUGIN_DEFINE=PLUGIN_DEFINE;
exports.VAR_TYPE=VAR_TYPE;
exports.XA_TYPE=XA_TYPE;
exports.ELSE_TYPE=ELSE_TYPE;
exports.PLUGIN_TYPE=PLUGIN_TYPE;
exports.CAPTURE_TYPE=CAPTURE_TYPE;
exports.IF_TYPE=IF_TYPE;
exports.EL_TYPE=EL_TYPE;
exports.BREAK_TYPE=BREAK_TYPE;
exports.XT_TYPE=XT_TYPE;
exports.FOR_TYPE=FOR_TYPE;
}
,
function(exports,require){


function ParseConfig(root,dom){
this.root = new URI(root && root.replace(/[\\\/]*$/,'/') || 'lite:///');
var json = dom && parseConfig(dom);
if(json){
var result = [];
var i = json.length
while(i--){
var item = {};
copy(json[i],item);
item.includes = new RegExp(item.includes||"^$");
item.excludes = new RegExp(item.excludes||"^$");
result[i] = item;
}
this._groups = result;
}else{
this._groups = defaultConfig;
}
}
function copy(source,dest){
for(var n in source){
dest[n] = source[n];
}
}
function findGroup(groups,path,require){
for(var i=0,len = groups.length;i<len;i++){
var g = groups[i];
if(g.includes.test(path)){
if(!g.excludes.test(path)){
return g;
}
}
}
return require && groups[groups.length-1];
}
ParseConfig.prototype = {




getConfig:function(path){
var result = {}
var g = findGroup(this._groups,path,null);
if(g){
copy(g.config,result);
}
return result;
},
getExtensionMap:function(path){
var g = findGroup(this._groups,path,null);
if(g){
return g.extensionMap;
}
return {};
}
}
var defaultConfig = {
"includes":/./,
"excludes":/^$/,
"config":{

"encoding":"utf-8",

"contentType":"text/html;charset=UTF-8"
},
"extensionMap":{





}
}
if(typeof require == 'function'){
exports.ParseConfig=ParseConfig;
var parseConfig = require(29).parseConfig;
var URI=require(7).URI;
}
}
,
function(exports,require){
var ID_PREFIX = "$_";
var XML_ENCODE_XA = 1;
var XML_ENCODE_XT = 2;

function TranslateContext(code,name,params){

this.name = name;

this.params = params;

this.scope = new OptimizeScope(code,params);
this.allocateIdMap = {};
this.outputIndent = 0;
}
TranslateContext.prototype = {
findForStatus:function(code){
var fis = this.scope.fors;
var i = fis.length;
while(i--){
var fi = fis[i];
if(fi.code == code){
return fi;
}
}

},
allocateId:function(id){
if(id && /^([\w\$_]+|[\d\.]+)$/.test(id)){
return id;
}
var i = 0;
while(true){
if(!this.allocateIdMap[i]){
this.allocateIdMap[i] = true;
return ID_PREFIX+i.toString(36);
}
i++;
}
},
freeId:function(id){
var len = ID_PREFIX.length;
if(id.substring(0,len) == ID_PREFIX){
delete this.allocateIdMap[id.substring(len)];
}
},

appendCode:function(code){
for(var i=0;i<code.length;i++){
var item = code[i];
if(typeof item == 'string'){
this.appendStatic(item)
}else{
var type = item && item[0];
switch(type){
case EL_TYPE:
this.visitEL(item[1],type)
this.appendEL(item);
break;
case XT_TYPE:
this.visitEL(item[1],type)
this.appendXT(item);
break;
case XA_TYPE:
this.visitEL(item[1],type)
this.appendXA(item);
break;
case VAR_TYPE:
this.visitEL(item[1],type)
this.appendVar(item);
break;
case CAPTURE_TYPE:
this.visitEL(null,type)
this.processCapture(item);
break;
case PLUGIN_TYPE:
this.visitEL(item[2],type)
this.processPlugin(item[1],item[2]);
break;
case IF_TYPE:
this.visitEL(item[2],type)
i = this.processIf(code,i);
break;
case FOR_TYPE:
this.visitEL(item[2],type)
i = this.processFor(code,i);
break;
case ELSE_TYPE:
this.visitEL(item[2],type)
i = this.processElse(code,i);
break;
default:
throw Error('无效指令：'+i+JSON.stringify(code))
}
}
}
},
visitEL:function(){},

processPlugin:function(child,config){
var pn = config['class'];
switch(pn.replace(/^org\.xidea\.lite\.(?:parse\.)?/,'')){
case 'EncodePlugin':
this.appendEncodePlugin(child[0]);
break;
case 'DatePlugin':
this.appendDatePlugin(child[0],child[1]);
break;
case 'NativePlugin':
this.appendNativePlugin(child,config);
break;
case 'ModulePlugin':
this.appendModulePlugin(child,config);
break;
case 'DefinePlugin':

break;
case 'ClientPlugin':

default:
console.error("程序bug(插件需要预处理):"+pn,config);
}
},
processElse:function(code,i){
throw Error('问题指令(无主else,else 指令必须紧跟if或者for)：'+code,i);
},
append:function(){
var outputIndent = this.outputIndent;
this.out.push("\n");
while(outputIndent--){
this.out.push("\t")
}
for(var i=0;i<arguments.length;i++){
this.out.push(arguments[i]);
}
},
reset:function(){
var out = this.out.concat();
this.out.length=0;
return out;
}
}
if(typeof require == 'function'){
exports.TranslateContext=TranslateContext;
var OptimizeScope=require(30).OptimizeScope;
var VAR_TYPE=require(14).VAR_TYPE;
var XA_TYPE=require(14).XA_TYPE;
var ELSE_TYPE=require(14).ELSE_TYPE;
var PLUGIN_TYPE=require(14).PLUGIN_TYPE;
var CAPTURE_TYPE=require(14).CAPTURE_TYPE;
var IF_TYPE=require(14).IF_TYPE;
var EL_TYPE=require(14).EL_TYPE;
var XT_TYPE=require(14).XT_TYPE;
var FOR_TYPE=require(14).FOR_TYPE;
}
}
,
function(exports,require){

function Expression(value){
if(typeof value == 'string'){
value = new ExpressionTokenizer(value).getResult();
}else if(value instanceof Expression){
return value;
}
this.token = value;
}
Expression.prototype.evaluate = function(context){
return evaluate(context,this.token);
}

Expression.prototype.getVarMap = function(){
init(this);
return this.varMap;
}

Expression.prototype.getCallMap = function(){
init(this);
return this.callMap;
}
function init(thiz){
if(thiz.callMap == null){
thiz.callMap = {};
thiz.varMap = {};
walkEL(thiz.token,thiz);
}
}
function walkEL(token,context){
var op = token[0];
if(op<=0){
if(op == VALUE_VAR){
_addKeyList(context.varMap,token[1],'');
}
return;
}else{
var arg1 = token[1];
if(op == OP_INVOKE){
if(arg1[0] == VALUE_VAR){
_addKeyList(context.callMap,arg1[1],'');
}else if(arg1[0] == OP_GET){
var list = walkMembers(arg1,context,[]).reverse();
var ps = list.slice(1).join('.');
if(list[0] != ''){
if(list[0] != '*' ){
_addKeyList(context.varMap,list[0],ps);
}
_addKeyList(context.callMap,list[0],ps);
}
}else{
walkEL(arg1,context);
_addKeyList(context.callMap,"*",'');
}
}else{
if(op == OP_GET){
var list = walkMembers(token,context,[]).reverse();
var ps = list.slice(1).join('.');
if(list[0] != ''){
if(list[0] != '*' ){
_addKeyList(context.varMap,list[0],ps);
}
}
}else{
arg1 && walkEL(arg1,context);
}
}
var pos = getTokenParamIndex(token[0]);
if(pos>2){
walkEL(token[2],context);
}
}
}
function walkMembers(token,context,buf){
var owner = token[1];
var key = token[2];
if(key[0] == VALUE_CONSTANTS){
buf.push(key[1]);
}else{
walkEL(key,context);
buf.push('*');
}
if(owner[0] == VALUE_VAR){
buf.push(owner[1]);
}else if(owner[0] == VALUE_CONSTANTS){
buf.push('');
}else if(owner[0] == OP_GET){
walkMembers(owner,context,buf);
}else{
walkEL(owner,context);
buf.push('*');
}
return buf;
}
function _addKeyList(map,key,value){
var list = key in map? map[key]: (map[key] = []);
if(list.indexOf(value) <0){
list.push(value);
}
return list;
}
Expression.prototype.toString = function(context){
return stringifyJSEL(this.token,context);

}
Expression.evaluate = evaluate;

function evaluate(context,el){
var result = _evaluate(el,context)
return realValue(result);
}
function _evaluate(item,context){
var type = item[0];
switch(type){
case VALUE_LIST:
return [];
case VALUE_MAP:
return {};
case VALUE_VAR:
arg1 = item[1]
return (arg1 in context?context:this)[arg1];
case VALUE_CONSTANTS:
arg1 = item[1];
return arg1&&arg1['class'] == 'RegExp'?window.eval(arg1.literal):arg1;

case OP_AND:
return realValue(_evaluate(item[1],context)) && (_evaluate(item[2],context));
case OP_OR:
return realValue(_evaluate(item[1],context)) || (_evaluate(item[2],context));
case OP_QUESTION:
if(realValue(_evaluate(item[1],context))){
return _evaluate(item[2],context);
}else{
return PropertyValue;
}
case OP_QUESTION_SELECT:
arg1 = realValue(_evaluate(item[1],context));
if(arg1 == PropertyValue){
return _evaluate(item[2],context);
}else{
return arg1;
}
}
var arg1=_evaluate(item[1],context);
if(getTokenParamIndex(type) ==3){
var arg2=realValue(_evaluate(item[2],context));
}
if(type == OP_INVOKE){
if(typeof arg1 == 'function'){
return arg1.apply(context,arg2);
}else if(arg1 instanceof PropertyValue){
var thiz = arg1[0];
var key = arg1[1];
var fn = thiz[key];

if(fn == String.prototype.replace || fn == String.prototype.match){
arg2 = arg2.slice(0);
var exp = arg2[0];
if(exp && exp['class'] == 'RegExp'){
arg2[0] = window.eval(exp.source)
}
}
return fn.apply(thiz,arg2);
}else{
throw new Error("not a fn!!"+arg1)
}
}
arg1 = realValue(arg1);
switch(type){



case OP_GET:
return new PropertyValue(arg1,arg2);
case OP_NOT:
return !arg1;
case OP_POS:
return +arg1;
case OP_NEG:
return -arg1;

case OP_ADD:
return arg1+arg2;
case OP_SUB:
return arg1-arg2;
case OP_MUL:
return arg1*arg2;
case OP_DIV:
return arg1/arg2;
case OP_MOD:
return arg1%arg2;

case OP_GT:
return arg1 > arg2;
case OP_GTEQ:
return arg1 >= arg2;
case OP_NE:
return arg1 != arg2;
case OP_NE_STRICT:
return arg1 !== arg2;
case OP_EQ:
return arg1 == arg2;
case OP_EQ_STRICT:
return arg1 === arg2;
case OP_LT:
return arg1 < arg2;
case OP_LTEQ:
return arg1 <= arg2;
case OP_IN:
return arg1 in arg2;
case OP_JOIN:
arg1.push(arg2)
return arg1;
case OP_PUT:
arg1[getTokenParam(item)]= arg2;
return arg1;
}
}
function PropertyValue(base,name){
this[0] = base;
this[1] = name;
}
function realValue(arg1){
if(arg1 instanceof PropertyValue){
return arg1[0][arg1[1]];
}
return arg1;
}
if(typeof require == 'function'){
exports.Expression=Expression;
var stringifyJSEL = require(31).stringifyJSEL
var ExpressionTokenizer=require(32).ExpressionTokenizer;
var getTokenParam=require(33).getTokenParam;
var getTokenParamIndex=require(33).getTokenParamIndex;
var OP_ADD=require(33).OP_ADD;
var OP_AND=require(33).OP_AND;
var OP_DIV=require(33).OP_DIV;
var OP_EQ=require(33).OP_EQ;
var OP_EQ_STRICT=require(33).OP_EQ_STRICT;
var OP_GET=require(33).OP_GET;
var OP_GT=require(33).OP_GT;
var OP_GTEQ=require(33).OP_GTEQ;
var OP_IN=require(33).OP_IN;
var OP_INVOKE=require(33).OP_INVOKE;
var OP_JOIN=require(33).OP_JOIN;
var OP_LT=require(33).OP_LT;
var OP_LTEQ=require(33).OP_LTEQ;
var OP_MOD=require(33).OP_MOD;
var OP_MUL=require(33).OP_MUL;
var OP_NE=require(33).OP_NE;
var OP_NEG=require(33).OP_NEG;
var OP_NE_STRICT=require(33).OP_NE_STRICT;
var OP_NOT=require(33).OP_NOT;
var OP_OR=require(33).OP_OR;
var OP_POS=require(33).OP_POS;
var OP_PUT=require(33).OP_PUT;
var OP_QUESTION=require(33).OP_QUESTION;
var OP_QUESTION_SELECT=require(33).OP_QUESTION_SELECT;
var OP_SUB=require(33).OP_SUB;
var VALUE_CONSTANTS=require(33).VALUE_CONSTANTS;
var VALUE_LIST=require(33).VALUE_LIST;
var VALUE_MAP=require(33).VALUE_MAP;
var VALUE_VAR=require(33).VALUE_VAR;
}
}
,
function(exports,require){
var BIT_PRIORITY= 60;
var BIT_PRIORITY_SUB= 3840;
var BIT_ARGS= 192;
var POS_INC= 12;
var VALUE_CONSTANTS= -1;
var VALUE_VAR= -2;
var VALUE_LIST= -3;
var VALUE_MAP= -4;
var OP_GET= 96;
var OP_INVOKE= 97;
var OP_NOT= 28;
var OP_BIT_NOT= 29;
var OP_POS= 30;
var OP_NEG= 31;
var OP_MUL= 88;
var OP_DIV= 89;
var OP_MOD= 90;
var OP_ADD= 84;
var OP_SUB= 85;
var OP_LSH= 80;
var OP_RSH= 81;
var OP_URSH= 82;
var OP_LT= 332;
var OP_GT= 333;
var OP_LTEQ= 334;
var OP_GTEQ= 335;
var OP_IN= 4428;
var OP_EQ= 76;
var OP_NE= 77;
var OP_EQ_STRICT= 78;
var OP_NE_STRICT= 79;
var OP_BIT_AND= 1096;
var OP_BIT_XOR= 840;
var OP_BIT_OR= 584;
var OP_AND= 328;
var OP_OR= 72;
var OP_QUESTION= 68;
var OP_QUESTION_SELECT= 69;
var OP_JOIN= 64;
var OP_PUT= 65;
var TYPE_TOKEN_MAP = {}
var TOKEN_TYPE_MAP = {}
function addToken(type,token){
TYPE_TOKEN_MAP[type] = token;
TOKEN_TYPE_MAP[token] = type;
}
addToken(VALUE_CONSTANTS ,"value");
addToken(VALUE_VAR ,"var");
addToken(VALUE_LIST ,"[]");
addToken(VALUE_MAP ,"{}");

addToken(OP_GET ,".");
addToken(OP_INVOKE ,"()");

addToken(OP_NOT ,"!");
addToken(OP_BIT_NOT ,"~");
addToken(OP_POS ,"+");
addToken(OP_NEG ,"-");

addToken(OP_MUL ,"*");
addToken(OP_DIV ,"/");
addToken(OP_MOD ,"%");


addToken(OP_ADD ,"+");
addToken(OP_SUB ,"-");

addToken(OP_LSH ,"<<");
addToken(OP_RSH ,">>");
addToken(OP_URSH ,">>>");

addToken(OP_LT ,"<");
addToken(OP_GT ,">");
addToken(OP_LTEQ ,"<=");
addToken(OP_GTEQ ,">=");
addToken(OP_IN ," in ");

addToken(OP_EQ ,"==");
addToken(OP_NE ,"!=");
addToken(OP_EQ_STRICT ,"===");
addToken(OP_NE_STRICT ,"!==");

addToken(OP_BIT_AND ,"&");
addToken(OP_BIT_XOR ,"^");
addToken(OP_BIT_OR ,"|");

addToken(OP_AND ,"&&");
addToken(OP_OR ,"||");


addToken(OP_QUESTION ,"?");

addToken(OP_QUESTION_SELECT ,":");


addToken(OP_JOIN ,",");

addToken(OP_PUT ,":");
function findTokenType(token) {
return TOKEN_TYPE_MAP[token];
}
function findTokenText(type) {
return TYPE_TOKEN_MAP[type];
}
function hasTokenParam(type) {
switch (type) {
case VALUE_VAR:
case VALUE_CONSTANTS:



case OP_PUT:
return true;
default:
return false;
}
}
function getTokenParam(el) {
return el[getTokenParamIndex(el[0])]
}
function getTokenLength(type) {
var size = getTokenParamIndex(type);
return hasTokenParam(type)?size+1:size;
}




































function getTokenParamIndex(type) {
if(type<0){
return 1;
}
var c = (type & BIT_ARGS) >> 6;
return c + 2;
}
var offset = 0
var TYPE_NULL = 1<<offset++;
var TYPE_BOOLEAN = 1<<offset++;
var TYPE_NUMBER = 1<<offset++;
var TYPE_STRING = 1<<offset++;
var TYPE_ARRAY = 1<<offset++;
var TYPE_MAP = 1<<offset++;
var TYPE_ANY = (1<<offset++) -1;







function isNTSFAN(type){
var isN = (type & TYPE_NULL) ||(type & TYPE_BOOLEAN) ||(type & TYPE_NUMBER);
var isS = (type & TYPE_STRING) ||(type & TYPE_ARRAY) ||(type & TYPE_MAP);
if(!isS ){
return true;
}
if(!isN ){
return false;
}
return null;
}
function getAddType(arg1,arg2){
var t1 = getELType(arg1);
var t2 = getELType(arg2);
var ns1 = isNTSFAN(t1);
var ns2 = isNTSFAN(t2);

if(ns1 === false || ns2 === false){
return TYPE_STRING;
}
if(ns1 === true && ns2 === true){
return TYPE_NUMBER;
}
return TYPE_NUMBER|TYPE_STRING;
}
function getELType(el){
var op = el[0];
var type;
if(op>0){
var arg1 = el[1];
var arg2 = el[2];
switch(op){
case OP_JOIN:
return TYPE_ARRAY;
case OP_PUT:
return TYPE_MAP;
case OP_ADD:



return getAddType(arg1,arg2)

case OP_POS:
case OP_NEG:
case OP_MUL:
case OP_DIV:
case OP_MOD:
case OP_SUB:
case OP_BIT_AND:
case OP_BIT_XOR:
case OP_BIT_OR:
case OP_BIT_NOT:
return TYPE_NUMBER;
case OP_NOT:
case OP_LT:
case OP_GT:
case OP_LTEQ:
case OP_GTEQ:
case OP_EQ:
case OP_NE:
case OP_EQ_STRICT:
case OP_NE_STRICT:
return TYPE_BOOLEAN;
case OP_AND:
case OP_OR:
return getELType(arg1) | getELType(arg2);
case OP_GET:
if(arg2[0] == VALUE_CONSTANTS){
if(arg1[0] == VALUE_VAR && arg1[1] == 'for'){
if(arg2[1] == 'index' || arg2[1] == 'lastIndex'){
return TYPE_NUMBER;
}
}else if( arg2[1] == 'length'){
var t1 = getELType(arg1);






if(t1 & TYPE_MAP){
return TYPE_ANY;
}else if((t1 & TYPE_ARRAY) || (t1 & TYPE_STRING)){
if((t1 & TYPE_STRING) || (t1 & TYPE_BOOLEAN)||(t1 & TYPE_NUMBER)){
return TYPE_NULL|TYPE_NUMBER;
}else{
return TYPE_NUMBER;
}
}else{
return TYPE_NULL;
}
}
}
return TYPE_ANY;
case OP_INVOKE:
if(arg1[0] == VALUE_VAR){
switch(arg1[1]){
case "encodeURI":
case "encodeURIComponent":
case "decodeURI":
case "decodeURIComponent":
return TYPE_STRING;
case "parseInt":
case "parseInt":
return TYPE_NUMBER;
case "isFinite":
case "isNaN":
return TYPE_BOOLEAN;
}
}else if(arg1[0] == OP_GET){

arg2 = arg1[2];
arg1 = arg1[1];
if(arg2[0] == VALUE_CONSTANTS){
var method = arg2[1];
if(arg1[0] == VALUE_VAR){
var owner = arg1[1];
if(owner == 'JSON'){
if(method == 'stringify'){
return TYPE_STRING;
}
}else if(owner == 'Math'){
return TYPE_NUMBER;
}
}
}
}
return TYPE_ANY;
default:
return TYPE_ANY;
}
}else{
switch(op){
case VALUE_CONSTANTS:
var v= el[1];
if(v == null){
return TYPE_NULL;
}
switch(typeof v){
case 'boolean':
return TYPE_BOOLEAN;
case 'number':
return TYPE_NUMBER;
case 'string':
return TYPE_STRING;
case 'object':
if(v instanceof Array){
return TYPE_ARRAY;
}
return TYPE_MAP;
}
return TYPE_ANY;
case VALUE_VAR:
return TYPE_ANY;
case VALUE_LIST:
return TYPE_ARRAY;
case VALUE_MAP:
return TYPE_MAP;
default:
return TYPE_ANY;
}
}
}

function addELQute(parentEl,childEL,value1,value2){
var pp = getPriority(parentEl[0]);
var cp = getPriority(childEL[0]);
if(value1){
if(cp<pp){
value1 = '('+value1+')';
}
return value1;
}else if(value2 && pp>=cp){
value2 = '('+value2+')';
}
return value2;
}
if(typeof require == 'function'){
exports.getTokenParam=getTokenParam;
exports.hasTokenParam=hasTokenParam;
exports.getTokenParamIndex=getTokenParamIndex;
exports.getTokenLength=getTokenLength;
exports.findTokenType=findTokenType;
exports.findTokenText=findTokenText;
exports.getELType=getELType;
exports.addELQute=addELQute;
exports.BIT_ARGS=BIT_ARGS;
exports.BIT_PRIORITY=BIT_PRIORITY;
exports.BIT_PRIORITY_SUB=BIT_PRIORITY_SUB;
exports.OP_ADD=OP_ADD;
exports.OP_AND=OP_AND;
exports.OP_BIT_AND=OP_BIT_AND;
exports.OP_BIT_NOT=OP_BIT_NOT;
exports.OP_BIT_OR=OP_BIT_OR;
exports.OP_BIT_XOR=OP_BIT_XOR;
exports.OP_DIV=OP_DIV;
exports.OP_EQ=OP_EQ;
exports.OP_EQ_STRICT=OP_EQ_STRICT;
exports.OP_GET=OP_GET;
exports.OP_GT=OP_GT;
exports.OP_GTEQ=OP_GTEQ;
exports.OP_IN=OP_IN;
exports.OP_INVOKE=OP_INVOKE;
exports.OP_JOIN=OP_JOIN;
exports.OP_LSH=OP_LSH;
exports.OP_LT=OP_LT;
exports.OP_LTEQ=OP_LTEQ;
exports.OP_MOD=OP_MOD;
exports.OP_MUL=OP_MUL;
exports.OP_NE=OP_NE;
exports.OP_NEG=OP_NEG;
exports.OP_NE_STRICT=OP_NE_STRICT;
exports.OP_NOT=OP_NOT;
exports.OP_OR=OP_OR;
exports.OP_POS=OP_POS;
exports.OP_PUT=OP_PUT;
exports.OP_QUESTION=OP_QUESTION;
exports.OP_QUESTION_SELECT=OP_QUESTION_SELECT;
exports.OP_RSH=OP_RSH;
exports.OP_SUB=OP_SUB;
exports.OP_URSH=OP_URSH;
exports.TYPE_ANY=TYPE_ANY;
exports.TYPE_ARRAY=TYPE_ARRAY;
exports.TYPE_BOOLEAN=TYPE_BOOLEAN;
exports.TYPE_MAP=TYPE_MAP;
exports.TYPE_NULL=TYPE_NULL;
exports.TYPE_NUMBER=TYPE_NUMBER;
exports.TYPE_STRING=TYPE_STRING;
exports.TYPE_TOKEN_MAP=TYPE_TOKEN_MAP;
exports.VALUE_CONSTANTS=VALUE_CONSTANTS;
exports.VALUE_LIST=VALUE_LIST;
exports.VALUE_MAP=VALUE_MAP;
exports.VALUE_VAR=VALUE_VAR;
var evaluate=require(34).evaluate;
var getPriority=require(32).getPriority;
}
}
,
function(exports,require){
var VAR_LITE_EL_TEMP = "$__el_tmp"
var FOR_STATUS_KEY = '$__for';

function stringifyPHPEL(el,context){
var type = el[0];
if(type<=0){
return stringifyValue(el,context)
}else if(getTokenParamIndex(type) ==3){
return stringifyInfix(el,context);
}else{
return stringifyPrefix(el,context);
}
}
function stringifyValue(el,context){
var param = el[1];
switch(el[0]){
case VALUE_CONSTANTS:
return stringifyPHP(param);
case VALUE_VAR:
if(param == 'for'){
return FOR_STATUS_KEY;
}else{
return '$'+param;
}
case VALUE_LIST:
case VALUE_MAP:
return "array()";
}
}
function typesOnly(t1,t2){
var i = arguments.length;
var a = 0;
while(--i>1){
a |= arguments[i];
}
var t = t1 | t2;
return (t & a) == t;
}
function stringifyADD(el,context){
var t = getELType(el);
var value1 = stringifyPHPEL(el[1],context);
var value2 = stringifyPHPEL(el[2],context);
if(t == TYPE_NUMBER){
return value1+'+'+value2;
}else if(t == TYPE_STRING){
if(/[\d]$/.test(value1)){
value1+=' ';
}
if(/^[\d]/.test(value2)){
value2=' '+value2;
}

var t1 = getELType(el[1]);
var t2 = getELType(el[2]);

if(typesOnly(t1,t2,TYPE_STRING,TYPE_NUMBER)){
return value1+'.'+value2;
}
}







return "lite_op__add("+value1+','+value2+")"
}






function stringifyEQ(el,context,opc){
var t1 = getELType(el[1]);
var t2 = getELType(el[2]);
var value1 = stringifyPHPEL(el[1],context);
var value2 = stringifyPHPEL(el[2],context);
opc = opc || '==';
if(t1 == TYPE_STRING || t2 == TYPE_STRING){
return "strcmp("+value1+","+value2+") "+opc+"0";
}
if(t1 === TYPE_NULL || t2 === TYPE_NULL){
return value1+opc+'='+value2;
}
if(typesOnly(t1,t2,TYPE_NUMBER,TYPE_BOOLEAN)



||typesOnly(t1,t2,TYPE_ARRAY,TYPE_MAP,TYPE_STRING)
||t1.toString(2).replace(/0/g,'').length==1 && t1 == t2){
return value1+opc+value2;
}
return (opc=='!='?'!':'')+"lite_op__eq("+value1+','+value2+")"
}
var math = {
"E":2.718281828459045,
"PI":3.141592653589793,
"LN2":0.6931471805599453,
"LN10":2.302585092994046,
"LOG2E":1.4426950408889634,
"LOG10E":0.4342944819032518,
"SQRT1_2":0.7071067811865476,
"SQRT2":1.4142135623730951
}
function stringifyGET(el,context){
var arg1 = el[1];
var arg2 = el[2];
var value1 = stringifyPHPEL(el[1],context);
var value2 = stringifyPHPEL(el[2],context);
if(arg2[0] == VALUE_CONSTANTS){
var prop = arg2[1];
if( prop != 'length'){

if(arg1[0] == VALUE_VAR){
var owner = arg1[1];
if(owner == 'Math' && !(owner in context.scope.defMap && owner in context.scope.varMap && owner in context.scope.paramMap)){
if(typeof math[prop] == 'number'){
return '('+math[prop]+')';
}
}
}
if(!/^[^(][\s\S]*\)$/.test(value1) && !/^(true|false|null|[\d\.]+)$/.test(value1)){
return value1+'['+value2+']';
}
}
}
return "lite_op__get("+value1+','+value2+")"
}

function parseInvoke(el){
var method = el[1];
if(method[0] == OP_GET){
var ownerEL = method[1];
var propEL = method[2];
if(ownerEL[0] == VALUE_VAR){
var varName = ownerEL[1];
}
if(propEL[0] == VALUE_CONSTANTS){
var prop = propEL[1];
}
return [varName||ownerEL,prop||propEL,el[2]];
}else{
if(method[0] == VALUE_VAR){
var varName = method[1];
}
return [varName||method,null,el[2]]
}
}
function stringifyPHPEL2ID(el,context,id){
if(typeof el != 'string'){
return stringifyPHPEL(el,context)
}else if(id){
return '$'+el;
}
return "'"+el+"'";
}
function stringifyINVOKE(el,context){
var info = parseInvoke(el);
var owner = info[0];
var prop = info[1];
var args = stringifyPHPEL(info[2],context);
if(prop){
if(typeof prop == 'string'){



if(owner === 'Math'){
var mp = /^(?:sin|sqrt|tan|cos|acos|asin|atan|atan2|max|min||floor|round|abs|ceil|exp|log|pow)$/;
if(prop == 'random'){
return '(rand(0, 0xFFFF)/0xFFFF)';
}else if(mp.test(prop)){
return args.replace('array',prop);
}else{
console.warn("Math 不支持方法:"+prop+";Math 支持的方法有:random|"+mp.source.replace(/[^\w\|]/g,''))
}
}else if(owner === 'JSON'){
if(prop == "parse"){
return args.replace('array','json_decode').slice(0,-1)+',true)';
}else if(prop =='stringify'){
return args.replace('array','json_encode');
}else{
console.warn("JSON 不支持方法:"+prop+";JSON 只支持:stringify和parse方法")
}
}else if(prop == 'reverse' && args == 'array()' && owner[0] == OP_INVOKE){
var info2 = parseInvoke(owner);

if(info2[1] == 'concat'){
owner = info2[0];
owner = stringifyPHPEL2ID(owner,context,true)
args = stringifyPHPEL(info2[2],context);
return "lite_op__invoke("+owner+",'concat_reverse',"+args+")"
}
}
}
owner = stringifyPHPEL2ID(owner,context,true)
prop = stringifyPHPEL2ID(prop,context)
return "lite_op__invoke("+owner+","+prop+","+args+")"

}else if(typeof owner == 'string'){
if((owner in GLOBAL_DEF_MAP || owner in context.scope.defMap)
&& !(owner in context.scope.varMap || owner in context.scope.paramMap)){

return args.replace('array',"lite__"+owner)
}else{


if(owner in context.scope.varMap || owner in context.scope.paramMap){
var fn = '$'+owner;
}else{
var fn = "isset($"+owner+")?$"+owner+":'"+owner+"'";
}
return 'lite_op__invoke('+fn+',null,'+args+')';
}
}else{

owner = stringifyPHPEL2ID(owner,context,true)

return 'lite_op__invoke('+owner+',null,'+args+')';

}
}

function stringifyInfix(el,context){
var type = el[0];
if(type == OP_ADD){
return stringifyADD(el,context)
}else if(type == OP_EQ){
return stringifyEQ(el,context,'==')
}else if(type == OP_NE){
return stringifyEQ(el,context,'!=');
}else if(type == OP_GET){
return stringifyGET(el,context);
}else if(type == OP_INVOKE){
return stringifyINVOKE(el,context);
}
var opc = findTokenText(el[0]);
var value1 = stringifyPHPEL(el[1],context);
var value2 = stringifyPHPEL(el[2],context);
switch(type){
case OP_JOIN:
if("array()"==value1){
return "array("+value2+")"
}else{
return value1.slice(0,-1)+','+value2+")"
}
case OP_PUT:
value2 = stringifyPHP(getTokenParam(el))+"=>"+value2+")";
if("array()"==value1){
return "array("+value2
}else{
return value1.slice(0,-1)+','+value2
}
case OP_QUESTION:





return null;
case OP_QUESTION_SELECT:

var arg1 = el[1];
var test = stringifyPHPEL(arg1[1],context);
var value1 = stringifyPHPEL(arg1[2],context);

return '('+php2jsBoolean(arg1[1],test)+'?'+value1+':'+value2+')'
case OP_AND:
if(isSimplePHPEL(value1)){
return '('+php2jsBoolean(el[1],value1)+'?'+value2+':'+value1+')'
}
return '(('+php2jsBoolean(el[1],value1,VAR_LITE_EL_TEMP)+')?'+value2+':'+VAR_LITE_EL_TEMP+')'
case OP_OR:
if(isSimplePHPEL(value1)){
return '('+php2jsBoolean(el[1],value1)+'?'+value1+':'+value2+')'
}
return '(('+php2jsBoolean(el[1],value1,VAR_LITE_EL_TEMP)+')?'+VAR_LITE_EL_TEMP+':'+value2 +')'
}
value1 = addELQute(el,el[1],value1)
value2 = addELQute(el,el[2],null,value2)
return value1 + opc + value2;
}
function stringifyPHP(value) {
switch (typeof value) {
case 'string':
return '\'' + value.replace(/[\\']/g,"\\$&")+ '\'';
case 'number':
if(isNaN(value)){
value = 'null';
}
return ''+value;
case 'undefined':
return 'null';
case 'object':
if (!value) {
return 'null';
}
var buf = [];
if (value instanceof Array) {
var i = value.length;
while (i--) {
buf[i] = stringifyPHP(value[i]) || 'null';
}
return 'array(' + buf.join(',') + ')';
}else if(value instanceof RegExp){
return "array('class'=>'RegExp','source'=>'"+value.replace(/[\\']/g,"\\$&")+"')";
}
for (var k in value) {
var v = stringifyPHP(value[k]);
if (v) {
buf.push(stringifyPHP(k) + '=>' + v);
}
}
return 'array(' + buf.join(',') + ')';
default:
return String(value);
}
}

function stringifyPrefix(el,context){
var type = el[0];
var el1 = el[1];
var value2 = stringifyPHPEL(el1,context);
var param = getTokenParam(el,context);
if(type == OP_NOT){

var rtv = php2jsBoolean(el1,value2);
if(!isSimplePHPEL(rtv)){
rtv = '('+rtv+')';
}
return '!'+rtv;
}
value2 = addELQute(el,el[1],null,value2)
var opc = findTokenText(type);
return opc+value2;
}

function php2jsBoolean(el,value,keepValue,context){
if(!value){
value = stringifyPHPEL(el,context);
}
var op = el[0];
if(op<=0){
switch(op){
case VALUE_CONSTANTS:
if(keepValue){
if(el[1]){
return '(('+keepValue+'='+value+')||true)';
}else{
return '(('+keepValue+'='+value+')&&false)';
}






}else{
return !!el[1]+'';
}
case VALUE_VAR:
break;
case VALUE_LIST:
case VALUE_MAP:
default:
if(keepValue){
return '(('+keepValue+'='+value+')||true)'
}else{
return 'true';
}
}
}







var type = getELType(el);
if(!((type & TYPE_STRING)||(type & TYPE_ARRAY)||(type & TYPE_MAP))){
if(!keepValue){
return value;
}else{
return '('+keepValue +'='+value+')';
}
}
if(isSimplePHPEL(value) && !keepValue){
var rtv = value;
keepValue = value;
}else{
keepValue = keepValue || VAR_LITE_EL_TEMP;
var rtv = "("+keepValue +"="+ value+")"
}
if((type & TYPE_ARRAY)||(type & TYPE_MAP)){
rtv+=' || 0 < '+keepValue;
}
if((type & TYPE_STRING)){
rtv+=" || '0' ==="+keepValue;
}
return '('+rtv+')'
}
function isSimplePHPEL(value){
return value.match(/^([\w_\$]+|[\d\.]+)$/)
}

function getELPriority(el) {
return getPriority(el[0]);
}
if(typeof require == 'function'){
exports.stringifyPHPEL=stringifyPHPEL;
exports.stringifyPHP=stringifyPHP;
exports.php2jsBoolean=php2jsBoolean;
exports.isSimplePHPEL=isSimplePHPEL;
var getTokenParam=require(18).getTokenParam;
var getTokenParamIndex=require(18).getTokenParamIndex;
var findTokenText=require(18).findTokenText;
var getELType=require(18).getELType;
var addELQute=require(18).addELQute;
var OP_ADD=require(18).OP_ADD;
var OP_AND=require(18).OP_AND;
var OP_EQ=require(18).OP_EQ;
var OP_GET=require(18).OP_GET;
var OP_IN=require(18).OP_IN;
var OP_INVOKE=require(18).OP_INVOKE;
var OP_JOIN=require(18).OP_JOIN;
var OP_NE=require(18).OP_NE;
var OP_NOT=require(18).OP_NOT;
var OP_OR=require(18).OP_OR;
var OP_PUT=require(18).OP_PUT;
var OP_QUESTION=require(18).OP_QUESTION;
var OP_QUESTION_SELECT=require(18).OP_QUESTION_SELECT;
var TYPE_ANY=require(18).TYPE_ANY;
var TYPE_ARRAY=require(18).TYPE_ARRAY;
var TYPE_BOOLEAN=require(18).TYPE_BOOLEAN;
var TYPE_MAP=require(18).TYPE_MAP;
var TYPE_NULL=require(18).TYPE_NULL;
var TYPE_NUMBER=require(18).TYPE_NUMBER;
var TYPE_STRING=require(18).TYPE_STRING;
var VALUE_CONSTANTS=require(18).VALUE_CONSTANTS;
var VALUE_LIST=require(18).VALUE_LIST;
var VALUE_MAP=require(18).VALUE_MAP;
var VALUE_VAR=require(18).VALUE_VAR;
var getPriority=require(35).getPriority;
var GLOBAL_DEF_MAP=require(1).GLOBAL_DEF_MAP;
}
}
,
function(exports,require){var findXMLAttribute=require(8).findXMLAttribute;
exports.interceptI18n =processI18N;
exports.parseI18n =processI18N;
exports.i18nHash = i18nHash;
function processI18N(node){
if (node.nodeType == 2) {
var el = node.ownerElement;
el.removeAttribute(node.name);
this.next(el);
}else if (node.nodeType == 1){
this.parse(node.childNodes);
}
}
function processI18N2(node){
var i18nKey = findXMLAttribute(node,'i18n');
var uri = this.currentURI;
var path = uri.scheme == 'lite'? uri.path: String(uri);
if(node.nodeType == 1){
var begin = this.mark();
_parseChild(this,node);
var content = this.reset(begin);
i18nKey = i18nHash(path,i18nKey,node.textContent);

this.parse("${I18N."+i18nKey+"}");
}else{
var el = node.ownerElement;
var node2 = el.cloneNode(true)||el;
var begin = this.mark();
this.parse(el.textContent);
var content = this.reset(begin);
i18nKey = i18nHash(path,i18nKey,el.textContent);
node2.textContent = "${I18N."+i18nKey+"}";
node2.removeAttribute(node.name);
node2.setAttribute('data-i18n-key',i18nKey)
this.next(node2);
}
addI18NData(this,i18nKey,content);
}
function seekI18N(text){
}

function parsePHP(node){
var value = node.textContent || node.text;
this.appendPlugin(PLUGIN_NATIVE,'{"type":"php"}');
parseChildRemoveAttr(this,node);
this.appendEnd();
}
function parseJS(node){
var value = node.textContent || node.text;
this.appendPlugin(PLUGIN_NATIVE,'{"type":"js"}');
parseChildRemoveAttr(this,node);
this.appendEnd();
}
function addI18NData(context,i18nKey,content){
if(typeof content != 'string' && content.length == 1){
content = content[0];
}
var i18nSource = context.getAttribute("#i18n-source");
var i18nObject = context.getAttribute("#i18n-object");
if(!i18nObject){
i18nObject = {};
context.setAttribute("#i18n-object",i18nObject);
}
if(i18nKey in i18nObject){
i18nObject[i18nKey] = content;
i18nSource = JSON.stringify(i18nObject)
}else{
if(i18nSource){
i18nSource = i18nSource.slice(0,-1)+',';
}else{
i18nSource = '{';
}
i18nSource = i18nSource + '"'+i18nKey+'":' +JSON.stringify(content)+'}';
}
context.setAttribute("#i18n-data",i18nSource);
}
function i18nHash(path,i18nKey,text){
path = path.replace(/[^\w]|_/g,function(c){
return '_'+numberToString(100+c.charCodeAt(),62).slice(-2)
});
if(!i18nKey){
i18nKey = 0;
text = text.replace(/[^\s]/,function(c){
i18nKey = i18nKey + (i18nKey & 2) + c.charCodeAt();
})
i18nKey = numberToString(i18nKey,62)
}
return path +'__'+ i18nKey;
}
var b64codes = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='.split('');
function numberToString(value,radix){
var buf = [];
while(value>0){
var m = value%radix;
buf.push(b64codes[m]);
value = (value-m)/radix;
}
return buf.reverse().join('')
}
}
,
function(exports,require){
function doOptimize(defMap,templateList){
var pluginObjectList = [];
var optimizeContext = [templateList,defMap,pluginObjectList];
optimizePluginWalk(templateList, function(parentNode, index) {
var cmd = parentNode[index];
var config = cmd[2];
var className = config["class"];
try {
var children =cmd[1];
var plugin = new PLUGIN_TYPE_MAP[className](config, children, optimizeContext);
pluginObjectList.push([plugin,cmd]);


} catch (e) {
console.warn("ParsePlugin initialize failed:" + config, e);
}
return index;
});
if(pluginObjectList.length){
for (var i=0,l=pluginObjectList.length;i<l;i++) {
pluginObjectList[i][0].before();
}

optimizePluginWalk(templateList, function( parentNode, index) {
var cmd = parentNode[index];
for (var i=0,l=pluginObjectList.length;i<l;i++) {
if(pluginObjectList[i][1] == cmd){
var p = pluginObjectList[i][0];
break;
}
}
if (p != null) {
p.optimize();
}
return index;
},null);
optimizePluginWalk(templateList, function( parentNode, index) {
var cmd = parentNode[index];
var config = cmd[2];
var className = config["class"];
if(className in PLUGIN_TYPE_MAP){
var children = cmd[1];
var args = [index,1].concat(children);
parentNode.splice.apply(parentNode,args);
index--;
index += children.length;
}
return index;
});
}
var result = [];
for(var n in defMap){
result.push(defMap[n]);
}
return result.concat(templateList);
}

function optimizeCallClosure(callMap,
closure) {
for(var n in closure){
if(!(n in callMap)){
delete closure[n]
}
}
var waitMap = closure;
while (true) {
var newClosure = {};
for (var fn in waitMap) {
var called = callMap[fn];
for (var fn2 in called) {
if ((fn2 in callMap)
&& !(fn2 in closure) && !(fn2 in newClosure)) {
newClosure[fn2]=1;
}
}
}
var hit = false;
for(var fn in newClosure){
hit = true;
closure[fn] = 1;
}
if (hit) {
waitMap = newClosure;
} else {
return;
}
}
}
var inc = 1;
function ClientPlugin(config, children, optimizeContext){
this.name = config.name;
this.params = config.params;
this.defaults = config.defaults;
this.children = children;
this.context = optimizeContext;
this.inc = inc++;
}
ClientPlugin.prototype = {
before:function(){
},
optimize:function(){

if(this.optimizedCall == null){
optimizeAllClient.apply(this,this.context);
}
var defMap = this.context[1]
var result = [];
for(var n in this.optimizedCall){
if(defMap[n]){
result.push(defMap[n]);
}else{
console.error("Defined function not found:"+n)
}
}




var jst = new JSTranslator();
var result = jst.translate(result.concat(this.children),{name:this.name,params:this.params,defaults:this.defaults});
this.children.length = 0;
this.children.push(result);
}
}
function getDefScope(data){
var scope = data[-1];
if(!scope){
scope = new OptimizeScope(data[1],data[2].params);
data[-1] = scope;
}
return scope;
}
function copy(source,target){
for(var n in source){
target[n] = source[n];
}
}
function remove(source,target){
for(var n in source){
delete target[n];
}
}
function getDefCall(data){
var scope = getDefScope(data);
var callMap = {}
copy(scope.callMap,callMap);




copy(scope.externalRefMap,callMap);
remove(scope.varMap,callMap);
remove(scope.paramMap,callMap);
delete callMap['*'];
return callMap
}
function optimizeAllClient(templateList,defMap,pluginObjectList){
var positionList = [];
var cmdList = [];
var namedClientCallMap = {};
var pluginList = [];
var dataList = [];
optimizePluginWalk(templateList, function( parentNode, index, post32) {
var cmd = parentNode[index];
for(var i = pluginObjectList.length;i--;){
var po = pluginObjectList[i];
if(po[1] == cmd && po[0] instanceof ClientPlugin){
var p = pluginObjectList[i][0];
positionList.push(post32);
pluginList.push(p);
cmdList.push(cmd);
if(p.name){
namedClientCallMap[p.name] = getDefCall(pluginObjectList[i][1]);
}
break;
}
}
return index;
},[]);
var callMap = {};
for(var n in namedClientCallMap){
callMap[n] = namedClientCallMap[n];
}
for(var n in defMap){
if(!(n in callMap)){
callMap[n] = getDefCall(defMap[n]);
}
}
for (var i = 0, end = positionList.length; i < end; i++) {
var plugin = pluginList[i];
var position = positionList[i];
var optimizedCall = getDefCall(cmdList[i]);
optimizeCallClosure(callMap, optimizedCall);
for(var n in optimizedCall){
if(n in namedClientCallMap){
delete optimizedCall[n];
}
}
var isFirst = true;
for (var j = 0; j < i; j++) {
if (position.indexOf(positionList[j]) ==0) {
var removeMap = pluginList[j].optimizedCall;
isFirst = false;
for(var n in removeMap){
delete optimizedCall[n];
}
}
}
plugin.first = isFirst;
plugin.optimizedCall = optimizedCall;
}
}
function ResourcePlugin(config, children, optimizeContext){
this.id = config.id;
this.context = optimizeContext;
this.children = children;
}
ResourcePlugin.prototype = {
before:function(){
var remove = [];
var id = this.id;
optimizePluginWalk(this.context[0],function(parentNode, index, position) {
var cmd = parentNode[index];
var config = cmd[2];
if (id == config.targetId) {
remove.push(parentNode,index)
}
return index;
});
while(remove.length){
var index = remove.pop();
var parentNode = remove.pop();
var cmds = parentNode.splice(index,1);
this.children.push(cmds[0]);
}
},
optimize:function(){
}
}
var PLUGIN_TYPE_MAP = {

"org.xidea.lite.parse.ClientPlugin":ClientPlugin,
"org.xidea.lite.parse.ResourcePlugin":ResourcePlugin
}

function optimizePluginWalk(source,callback,position){
for (var i = 0; i < source.length; i++) {
var item = source[i];
if (item instanceof Array) {
var cmd = item;
var type = cmd[0];
switch (type) {
case PLUGIN_TYPE:
var config = cmd[2];
var className = config["class"];
if (PLUGIN_TYPE_MAP[className]) {
var j = callback(source, i, position && String.fromCharCode.apply(null,position));
if (j == -1) {
return true;
} else {
i = j;
}
}
case CAPTURE_TYPE:
case IF_TYPE:
case ELSE_TYPE:
case FOR_TYPE:
try{
if (position) {
position.push(type,i+32);
}
if(optimizePluginWalk(cmd[1], callback, position)){
return true;
}
}finally{
if (position) {
position.pop();position.pop();
}
}
}
}
}
return false;
}

function optimizeResult(source){
var result = [];
var previousText;
for(var i=0,j=0;i<source.length;i++){
var item = source[i];
if ('string' == typeof item) {
if(previousText==null){
previousText = item;
}else{
previousText += item;
}
}else{
if(previousText){
result[j++] = previousText;
}
previousText = null;
result[j++] = item;
}
}
if(previousText){
result[j] = previousText;
}
return result;
}

function buildTreeResult(result,defMap){
var stack = [];
var current = [];
stack.push(current);
try{
for (var i = 0;i<result.length;i++) {
var item = result[i];
if ('string' == typeof item) {
current.push(item);
} else {
if (item.length == 0) {
var children = stack.pop();
current = stack[stack.length-1];
var parentNode = current.pop();
parentNode[1]=children;
if(parentNode[0] == PLUGIN_TYPE){
var config = parentNode[2];
if(config['class']== 'org.xidea.lite.DefinePlugin'){
var name_ = config.name;
if(name_ in defMap){
if(JSON.stringify(parentNode) != JSON.stringify(defMap[name_])){
console.warn("def "+name_+" is found before");
}
}
defMap[name_]=parentNode;
}else{
current.push(parentNode);
}
}else{
current.push(parentNode);
}
} else {
var type = item[0];
var cmd2 =[];
cmd2.push(item[0]);
current.push(cmd2);
switch (type) {
case CAPTURE_TYPE:
case IF_TYPE:
case ELSE_TYPE:
case PLUGIN_TYPE:
case FOR_TYPE:
cmd2.push(null);
stack.push(current = []);
}
for (var j = 1; j < item.length; j++) {
cmd2.push(item[j]);
}
}
}
}
}catch(e){
console.error("中间代码异常：",result);
}
return current;

}
if(typeof require == 'function'){

exports.doOptimize=doOptimize;
exports.optimizeResult=optimizeResult;
exports.buildTreeResult=buildTreeResult;
exports.PLUGIN_TYPE_MAP=PLUGIN_TYPE_MAP;
var OptimizeScope=require(30).OptimizeScope;
var PLUGIN_DEFINE=require(14).PLUGIN_DEFINE;
var PLUGIN_TYPE=require(14).PLUGIN_TYPE;
var CAPTURE_TYPE=require(14).CAPTURE_TYPE;
var VAR_TYPE=require(14).VAR_TYPE;
var JSTranslator=require(1).JSTranslator;
var PLUGIN_DEFINE=require(14).PLUGIN_DEFINE;
var VAR_TYPE=require(14).VAR_TYPE;
var ELSE_TYPE=require(14).ELSE_TYPE;
var PLUGIN_TYPE=require(14).PLUGIN_TYPE;
var CAPTURE_TYPE=require(14).CAPTURE_TYPE;
var IF_TYPE=require(14).IF_TYPE;
var FOR_TYPE=require(14).FOR_TYPE;
}
}
,
function(exports,require){function DOMParser(options){
this.options = options ||{locator:{}};
}
DOMParser.prototype.parseFromString = function(source,mimeType){
var options = this.options;
var sax = new XMLReader();
var domBuilder = options.domBuilder || new DOMHandler();
var errorHandler = options.errorHandler;
var locator = options.locator;
var defaultNSMap = options.xmlns||{};
var entityMap = {'lt':'<','gt':'>','amp':'&','quot':'"','apos':"'"}
if(locator){
domBuilder.setDocumentLocator(locator)
}
sax.errorHandler = buildErrorHandler(errorHandler,domBuilder,locator);
sax.domBuilder = options.domBuilder || domBuilder;
if(/\/x?html?$/.test(mimeType)){
entityMap.nbsp = '\xa0';
entityMap.copy = '\xa9';
defaultNSMap['']= 'http://www.w3.org/1999/xhtml';
}
defaultNSMap.xml = defaultNSMap.xml || 'http://www.w3.org/XML/1998/namespace';
if(source){
sax.parse(source,defaultNSMap,entityMap);
}else{
sax.errorHandler.error("invalid doc source");
}
return domBuilder.doc;
}
function buildErrorHandler(errorImpl,domBuilder,locator){
if(!errorImpl){
if(domBuilder instanceof DOMHandler){
return domBuilder;
}
errorImpl = domBuilder ;
}
var errorHandler = {}
var isCallback = errorImpl instanceof Function;
locator = locator||{}
function build(key){
var fn = errorImpl[key];
if(!fn && isCallback){
fn = errorImpl.length == 2?function(msg){errorImpl(key,msg)}:errorImpl;
}
errorHandler[key] = fn && function(msg){
fn('[xmldom '+key+']\t'+msg+_locator(locator));
}||function(){};
}
build('warning');
build('error');
build('fatalError');
return errorHandler;
}


function DOMHandler() {
this.cdata = false;
}
function position(locator,node){
node.lineNumber = locator.lineNumber;
node.columnNumber = locator.columnNumber;
}
 
DOMHandler.prototype = {
startDocument : function() {
this.doc = new DOMImplementation().createDocument(null, null, null);
if (this.locator) {
this.doc.documentURI = this.locator.systemId;
}
},
startElement:function(namespaceURI, localName, qName, attrs) {
var doc = this.doc;
var el = doc.createElementNS(namespaceURI, qName||localName);
var len = attrs.length;
appendElement(this, el);
this.currentElement = el;
this.locator && position(this.locator,el)
for (var i = 0 ; i < len; i++) {
var namespaceURI = attrs.getURI(i);
var value = attrs.getValue(i);
var qName = attrs.getQName(i);
var attr = doc.createAttributeNS(namespaceURI, qName);
this.locator &&position(attrs.getLocator(i),attr);
attr.value = attr.nodeValue = value;
el.setAttributeNode(attr)
}
},
endElement:function(namespaceURI, localName, qName) {
var current = this.currentElement
var tagName = current.tagName;
this.currentElement = current.parentNode;
},
startPrefixMapping:function(prefix, uri) {
},
endPrefixMapping:function(prefix) {
},
processingInstruction:function(target, data) {
var ins = this.doc.createProcessingInstruction(target, data);
this.locator && position(this.locator,ins)
appendElement(this, ins);
},
ignorableWhitespace:function(ch, start, length) {
},
characters:function(chars, start, length) {
chars = _toString.apply(this,arguments)

if(chars){
if (this.cdata) {
var charNode = this.doc.createCDATASection(chars);
} else {
var charNode = this.doc.createTextNode(chars);
}
if(this.currentElement){
this.currentElement.appendChild(charNode);
}else if(/^\s*$/.test(chars)){
this.doc.appendChild(charNode);

}
this.locator && position(this.locator,charNode)
}
},
skippedEntity:function(name) {
},
endDocument:function() {
this.doc.normalize();
},
setDocumentLocator:function (locator) {
if(this.locator = locator){
locator.lineNumber = 0;
}
},

comment:function(chars, start, length) {
chars = _toString.apply(this,arguments)
var comm = this.doc.createComment(chars);
this.locator && position(this.locator,comm)
appendElement(this, comm);
},
startCDATA:function() {

this.cdata = true;
},
endCDATA:function() {
this.cdata = false;
},
startDTD:function(name, publicId, systemId) {
var impl = this.doc.implementation;
if (impl && impl.createDocumentType) {
var dt = impl.createDocumentType(name, publicId, systemId);
this.locator && position(this.locator,dt)
appendElement(this, dt);
}
},

warning:function(error) {
console.warn('[xmldom warning]\t'+error,_locator(this.locator));
},
error:function(error) {
console.error('[xmldom error]\t'+error,_locator(this.locator));
},
fatalError:function(error) {
console.error('[xmldom fatalError]\t'+error,_locator(this.locator));
throw error;
}
}
function _locator(l){
if(l){
return '\n@'+(l.systemId ||'')+'#[line:'+l.lineNumber+',col:'+l.columnNumber+']'
}
}
function _toString(chars,start,length){
if(typeof chars == 'string'){
return chars.substr(start,length)
}else{
if(chars.length >= start+length || start){
return new java.lang.String(chars,start,length)+'';
}
return chars;
}
}

"endDTD,startEntity,endEntity,attributeDecl,elementDecl,externalEntityDecl,internalEntityDecl,resolveEntity,getExternalSubset,notationDecl,unparsedEntityDecl".replace(/\w+/g,function(key){
DOMHandler.prototype[key] = function(){return null}
})

function appendElement (hander,node) {
if (!hander.currentElement) {
hander.doc.appendChild(node);
} else {
hander.currentElement.appendChild(node);
}
}

var XMLReader = require(36).XMLReader;
var DOMImplementation = exports.DOMImplementation = require(37).DOMImplementation;
exports.XMLSerializer = require(37).XMLSerializer ;
exports.DOMParser = DOMParser;

}
,
function(exports,require,module){
(function(global, factory) {
if (typeof module == 'object' && typeof exports == 'object') {


module.exports = function (browserGlobal) {


browserGlobal.console = console;
browserGlobal.parseInt = parseInt;
browserGlobal.Function = Function;
browserGlobal.Boolean = Boolean;
browserGlobal.Number = Number;
browserGlobal.RegExp = RegExp;
browserGlobal.String = String;
browserGlobal.Object = Object;
browserGlobal.Array = Array;
browserGlobal.Error = Error;
browserGlobal.Date = Date;
browserGlobal.Math = Math;
var exports = browserGlobal.Object();
factory(browserGlobal, exports);
return exports;
};
module.factory = factory;
} else {


factory(global,
(global.NW || (global.NW = global.Object())) &&
(global.NW.Dom || (global.NW.Dom = global.Object())));
global.NW.Dom.factory = factory;
}
})(this, function(global, exports) {
var version = 'nwmatcher-1.3.6',
Dom = exports,

doc = global.document,
root = doc.documentElement,

slice = global.Array.prototype.slice,
string = global.Object.prototype.toString,

isSingleMatch,
isSingleSelect,
lastSlice,
lastContext,
lastPosition,
lastMatcher,
lastSelector,
lastPartsMatch,
lastPartsSelect,


prefixes = '[#.:]?',

operators = '([~*^$|!]?={1})',

whitespace = '[\\x20\\t\\n\\r\\f]*',

combinators = '[\\x20]|[>+~][^>+~]',

pseudoparms = '(?:[-+]?\\d*n)?[-+]?\\d*',

quotedvalue = '"[^"\\\\]*(?:\\\\.[^"\\\\]*)*"' + "|'[^'\\\\]*(?:\\\\.[^'\\\\]*)*'",

skipround = '\\([^()]+\\)|\\(.*\\)',

skipcurly = '\\{[^{}]+\\}|\\{.*\\}',

skipsquare = '\\[[^[\\]]*\\]|\\[.*\\]',

skipgroup = '\\[.*\\]|\\(.*\\)|\\{.*\\}',





encoding = '(?:[-\\w]|[^\\x00-\\xa0]|\\\\.)',

identifier = '(?:-?[_a-zA-Z]{1}[-\\w]*|[^\\x00-\\xa0]+|\\\\.+)+',

attrcheck = '(' + quotedvalue + '|' + identifier + ')',
attributes = whitespace + '(' + encoding + '*:?' + encoding + '+)' +
whitespace + '(?:' + operators + whitespace + attrcheck + ')?' + whitespace,
attrmatcher = attributes.replace(attrcheck, '([\\x22\\x27]*)((?:\\\\?.)*?)\\3'),

pseudoclass = '((?:' +

pseudoparms + '|' + quotedvalue + '|' +

prefixes + '|' + encoding + '+|' +

'\\[' + attributes + '\\]|' +

'\\(.+\\)|' + whitespace + '|' +

',)+)',

extensions = '.+',



standardValidator =

'(?=[\\x20\\t\\n\\r\\f]*[^>+~(){}<>])' +

'(' +

'\\*' +

'|(?:' + prefixes + identifier + ')' +

'|' + combinators +

'|\\[' + attributes + '\\]' +

'|\\(' + pseudoclass + '\\)' +

'|\\{' + extensions + '\\}' +

'|(?:,|' + whitespace + ')' +

')+',

extendedValidator = standardValidator.replace(pseudoclass, '.*'),

reValidator = new global.RegExp(standardValidator, 'g'),


reTrimSpaces = new global.RegExp('^' +
whitespace + '|' + whitespace + '$', 'g'),

reSimpleNot = new global.RegExp('^(' +
'(?!:not)' +
'(' + prefixes +
'|' + identifier +
'|\\([^()]*\\))+' +
'|\\[' + attributes + '\\]' +
')$'),


reSplitGroup = new global.RegExp('(' +
'[^,\\\\()[\\]]+' +
'|' + skipsquare +
'|' + skipround +
'|' + skipcurly +
'|\\\\.' +
')+', 'g'),

reSplitToken = new global.RegExp('(' +
'\\[' + attributes + '\\]|' +
'\\(' + pseudoclass + '\\)|' +
'\\\\.|[^\\x20\\t\\r\\n\\f>+~])+', 'g'),

reWhiteSpace = /[\x20\t\n\r\f]+/g,
reOptimizeSelector = new global.RegExp(identifier + '|^$'),


isNative = (function() {
var re = / \w+\(/,
isnative = String(Object.prototype.toString).replace(re, ' (');
return function(method) {
return method && typeof method != 'string' &&
isnative == String(method).replace(re, ' (');
};
})(),


NATIVE_FOCUS = isNative(doc.hasFocus),
NATIVE_QSAPI = isNative(doc.querySelector),
NATIVE_GEBID = isNative(doc.getElementById),
NATIVE_GEBTN = isNative(root.getElementsByTagName),
NATIVE_GEBCN = isNative(root.getElementsByClassName),




NATIVE_GET_ATTRIBUTE = isNative(root.getAttribute),
NATIVE_HAS_ATTRIBUTE = isNative(root.hasAttribute),


NATIVE_SLICE_PROTO =
(function() {
var isBuggy = false;
try {
isBuggy = !!slice.call(doc.childNodes, 0)[0];
} catch(e) { }
return isBuggy;
})(),

NATIVE_TRAVERSAL_API =
'nextElementSibling' in root && 'previousElementSibling' in root,


BUGGY_GEBID = NATIVE_GEBID ?
(function() {
var isBuggy = true, x = 'x' + global.String(+new global.Date),
a = doc.createElementNS ? 'a' : '<a name="' + x + '">';
(a = doc.createElement(a)).name = x;
root.insertBefore(a, root.firstChild);
isBuggy = !!doc.getElementById(x);
root.removeChild(a);
return isBuggy;
})() :
true,

BUGGY_GEBTN = NATIVE_GEBTN ?
(function() {
var div = doc.createElement('div');
div.appendChild(doc.createComment(''));
return !!div.getElementsByTagName('*')[0];
})() :
true,



BUGGY_GEBCN = NATIVE_GEBCN ?
(function() {
var isBuggy, div = doc.createElement('div'), test = '\u53f0\u5317';

div.appendChild(doc.createElement('span')).
setAttribute('class', test + 'abc ' + test);
div.appendChild(doc.createElement('span')).
setAttribute('class', 'x');
isBuggy = !div.getElementsByClassName(test)[0];

div.lastChild.className = test;
return isBuggy || div.getElementsByClassName(test).length != 2;
})() :
true,

BUGGY_GET_ATTRIBUTE = NATIVE_GET_ATTRIBUTE ?
(function() {
var input = doc.createElement('input');
input.setAttribute('value', 5);
return input.defaultValue != 5;
})() :
true,

BUGGY_HAS_ATTRIBUTE = NATIVE_HAS_ATTRIBUTE ?
(function() {
var option = doc.createElement('option');
option.setAttribute('selected', 'selected');
return !option.hasAttribute('selected');
})() :
true,

BUGGY_SELECTED =
(function() {
var select = doc.createElement('select');
select.appendChild(doc.createElement('option'));
return !select.firstChild.selected;
})(),


BUGGY_QUIRKS_GEBCN,
BUGGY_QUIRKS_QSAPI,
QUIRKS_MODE,
XML_DOCUMENT,

OPERA = /opera/i.test(string.call(global.opera)),

OPERA_QSAPI = OPERA && global.parseFloat(global.opera.version()) >= 11,

RE_BUGGY_QSAPI = NATIVE_QSAPI ?
(function() {
var pattern = new global.Array(), context, element,
expect = function(selector, element, n) {
var result = false;
context.appendChild(element);
try { result = context.querySelectorAll(selector).length == n; } catch(e) { }
while (context.firstChild) { context.removeChild(context.firstChild); }
return result;
};


if (doc.implementation && doc.implementation.createDocument) {

context = doc.implementation.createDocument('', '', null).
appendChild(doc.createElement('html')).
appendChild(doc.createElement('head')).parentNode.
appendChild(doc.createElement('body'));
} else {

context = doc.createElement('div');
}


element = doc.createElement('div');
element.innerHTML = '<p id="a"></p><br>';
expect('p#a+*', element, 0) &&
pattern.push('\\w+#\\w+.*[+~]');

element = doc.createElement('p');
element.setAttribute('class', '');
expect('[class^=""]', element, 1) &&
pattern.push('[*^$]=[\\x20\\t\\n\\r\\f]*(?:""|' + "'')");



element = doc.createElement('option');
element.setAttribute('selected', 'selected');
expect(':checked', element, 0) &&
pattern.push(':checked');




element = doc.createElement('input');
element.setAttribute('type', 'hidden');
expect(':enabled', element, 0) &&
pattern.push(':enabled', ':disabled');

element = doc.createElement('link');
element.setAttribute('href', 'x');
expect(':link', element, 1) ||
pattern.push(':link');

if (BUGGY_HAS_ATTRIBUTE) {



pattern.push('\\[[\\x20\\t\\n\\r\\f]*(?:checked|disabled|ismap|multiple|readonly|selected|value)');
}
return pattern.length ?
new global.RegExp(pattern.join('|')) :
{ 'test': function() { return false; } };
})() :
true,

RE_CLASS = new global.RegExp('(?:\\[[\\x20\\t\\n\\r\\f]*class\\b|\\.' + identifier + ')'),

RE_SIMPLE_SELECTOR = new global.RegExp(
BUGGY_GEBTN && BUGGY_GEBCN || OPERA ?
'^#?-?[_a-zA-Z]{1}' + encoding + '*$' : BUGGY_GEBTN ?
'^[.#]?-?[_a-zA-Z]{1}' + encoding + '*$' : BUGGY_GEBCN ?
'^(?:\\*|#-?[_a-zA-Z]{1}' + encoding + '*)$' :
'^(?:\\*|[.#]?-?[_a-zA-Z]{1}' + encoding + '*)$'),

LINK_NODES = new global.Object({ 'a': 1, 'A': 1, 'area': 1, 'AREA': 1, 'link': 1, 'LINK': 1 }),

ATTR_BOOLEAN = new global.Object({
'checked': 1, 'disabled': 1, 'ismap': 1,
'multiple': 1, 'readonly': 1, 'selected': 1
}),

ATTR_DEFAULT = new global.Object({
'value': 'defaultValue',
'checked': 'defaultChecked',
'selected': 'defaultSelected'
}),

ATTR_URIDATA = new global.Object({
'action': 2, 'cite': 2, 'codebase': 2, 'data': 2, 'href': 2,
'longdesc': 2, 'lowsrc': 2, 'src': 2, 'usemap': 2
}),


HTML_TABLE = new global.Object({



'class': 0,
'accept': 1, 'accept-charset': 1, 'align': 1, 'alink': 1, 'axis': 1,
'bgcolor': 1, 'charset': 1, 'checked': 1, 'clear': 1, 'codetype': 1, 'color': 1,
'compact': 1, 'declare': 1, 'defer': 1, 'dir': 1, 'direction': 1, 'disabled': 1,
'enctype': 1, 'face': 1, 'frame': 1, 'hreflang': 1, 'http-equiv': 1, 'lang': 1,
'language': 1, 'link': 1, 'media': 1, 'method': 1, 'multiple': 1, 'nohref': 1,
'noresize': 1, 'noshade': 1, 'nowrap': 1, 'readonly': 1, 'rel': 1, 'rev': 1,
'rules': 1, 'scope': 1, 'scrolling': 1, 'selected': 1, 'shape': 1, 'target': 1,
'text': 1, 'type': 1, 'valign': 1, 'valuetype': 1, 'vlink': 1
}),


XHTML_TABLE = new global.Object({
'accept': 1, 'accept-charset': 1, 'alink': 1, 'axis': 1,
'bgcolor': 1, 'charset': 1, 'codetype': 1, 'color': 1,
'enctype': 1, 'face': 1, 'hreflang': 1, 'http-equiv': 1,
'lang': 1, 'language': 1, 'link': 1, 'media': 1, 'rel': 1,
'rev': 1, 'target': 1, 'text': 1, 'type': 1, 'vlink': 1
}),


Selectors = new global.Object({











}),

Operators = new global.Object({
'=': "n=='%m'",
'^=': "n.indexOf('%m')==0",
'*=': "n.indexOf('%m')>-1",
'|=': "(n+'-').indexOf('%m-')==0",
'~=': "(' '+n+' ').indexOf(' %m ')>-1",
'$=': "n.substr(n.length-'%m'.length)=='%m'"
}),

Optimize = new global.Object({
ID: new global.RegExp('^\\*?#(' + encoding + '+)|' + skipgroup),
TAG: new global.RegExp('^(' + encoding + '+)|' + skipgroup),
CLASS: new global.RegExp('^\\*?\\.(' + encoding + '+$)|' + skipgroup)
}),

Patterns = new global.Object({

spseudos: /^\:(root|empty|(?:first|last|only)(?:-child|-of-type)|nth(?:-last)?(?:-child|-of-type)\(\s*(even|odd|(?:[-+]{0,1}\d*n\s*)?[-+]{0,1}\s*\d*)\s*\))?(.*)/i,

dpseudos: /^\:(link|visited|target|active|focus|hover|checked|disabled|enabled|selected|lang\(([-\w]{2,})\)|not\(([^()]*|.*)\))?(.*)/i,

attribute: new global.RegExp('^\\[' + attrmatcher + '\\](.*)'),

children: /^[\x20\t\n\r\f]*\>[\x20\t\n\r\f]*(.*)/,

adjacent: /^[\x20\t\n\r\f]*\+[\x20\t\n\r\f]*(.*)/,

relative: /^[\x20\t\n\r\f]*\~[\x20\t\n\r\f]*(.*)/,

ancestor: /^[\x20\t\n\r\f]+(.*)/,

universal: /^\*(.*)/,

id: new global.RegExp('^#(' + encoding + '+)(.*)'),

tagName: new global.RegExp('^(' + encoding + '+)(.*)'),

className: new global.RegExp('^\\.(' + encoding + '+)(.*)')
}),


concatList =
function(data, elements) {
var i = -1, element;
if (!data.length && global.Array.slice)
return global.Array.slice(elements);
while ((element = elements[++i]))
data[data.length] = element;
return data;
},

concatCall =
function(data, elements, callback) {
var i = -1, element;
while ((element = elements[++i])) {
if (false === callback(data[data.length] = element)) { break; }
}
return data;
},

switchContext =
function(from, force) {
var div, oldDoc = doc;

lastContext = from;

doc = from.ownerDocument || from;
if (force || oldDoc !== doc) {

root = doc.documentElement;

XML_DOCUMENT = doc.createElement('DiV').nodeName == 'DiV';




QUIRKS_MODE = !XML_DOCUMENT &&
typeof doc.compatMode == 'string' ?
doc.compatMode.indexOf('CSS') < 0 :
(function() {
var style = doc.createElement('div').style;
return style && (style.width = 1) && style.width == '1px';
})();
div = doc.createElement('div');
div.appendChild(doc.createElement('p')).setAttribute('class', 'xXx');
div.appendChild(doc.createElement('p')).setAttribute('class', 'xxx');



BUGGY_QUIRKS_GEBCN =
!XML_DOCUMENT && NATIVE_GEBCN && QUIRKS_MODE &&
(div.getElementsByClassName('xxx').length != 2 ||
div.getElementsByClassName('xXx').length != 2);






BUGGY_QUIRKS_QSAPI =
!XML_DOCUMENT && NATIVE_QSAPI && QUIRKS_MODE &&
(div.querySelectorAll('[class~=xxx]').length != 2 ||
div.querySelectorAll('.xXx').length != 2);
Config.CACHING && Dom.setCache(true, doc);
}
},


convertEscapes =
function(str) {
return str.replace(/\\([0-9a-fA-F]{1,6}\x20?|.)|([\x22\x27])/g, function(substring, p1, p2) {
var codePoint, highHex, highSurrogate, lowHex, lowSurrogate;
if (p2) {

return '\\' + p2;
}
if (/^[0-9a-fA-F]/.test(p1)) {

codePoint = parseInt(p1, 16);
if (codePoint < 0 || codePoint > 0x10ffff) {

return '\\ufffd';
}

if (codePoint <= 0xffff) {

lowHex = '000' + codePoint.toString(16);
return '\\u' + lowHex.substr(lowHex.length - 4);
}

codePoint -= 0x10000;
highSurrogate = (codePoint >> 10) + 0xd800;
lowSurrogate = (codePoint % 0x400) + 0xdc00;
highHex = '000' + highSurrogate.toString(16);
lowHex = '000' + lowSurrogate.toString(16);
return '\\u' + highHex.substr(highHex.length - 4) +
'\\u' + lowHex.substr(lowHex.length - 4);
}
if (/^[\\\x22\x27]/.test(p1)) {

return substring;
}

return p1;
});
},



byIdRaw =
function(id, elements) {
var i = -1, element = null;
while ((element = elements[++i])) {
if (element.getAttribute('id') == id) {
break;
}
}
return element;
},


_byId = !BUGGY_GEBID ?
function(id, from) {
id = id.replace(/\\([^\\]{1})/g, '$1');
return from.getElementById && from.getElementById(id) ||
byIdRaw(id, from.getElementsByTagName('*'));
} :
function(id, from) {
var element = null;
id = id.replace(/\\([^\\]{1})/g, '$1');
if (XML_DOCUMENT || from.nodeType != 9) {
return byIdRaw(id, from.getElementsByTagName('*'));
}
if ((element = from.getElementById(id)) &&
element.name == id && from.getElementsByName) {
return byIdRaw(id, from.getElementsByName(id));
}
return element;
},


byId =
function(id, from) {
from || (from = doc);
if (lastContext !== from) { switchContext(from); }
return _byId(id, from);
},


byTagRaw =
function(tag, from) {
var any = tag == '*', element = from, elements = new global.Array(), next = element.firstChild;
any || (tag = tag.toUpperCase());
while ((element = next)) {
if (element.tagName > '@' && (any || element.tagName.toUpperCase() == tag)) {
elements[elements.length] = element;
}
if ((next = element.firstChild || element.nextSibling)) continue;
while (!next && (element = element.parentNode) && element !== from) {
next = element.nextSibling;
}
}
return elements;
},


_byTag = !BUGGY_GEBTN && NATIVE_SLICE_PROTO ?
function(tag, from) {
return XML_DOCUMENT || from.nodeType == 11 ? byTagRaw(tag, from) :
slice.call(from.getElementsByTagName(tag), 0);
} :
function(tag, from) {
var i = -1, j = i, data = new global.Array(),
element, elements = from.getElementsByTagName(tag);
if (tag == '*') {
while ((element = elements[++i])) {
if (element.nodeName > '@')
data[++j] = element;
}
} else {
while ((element = elements[++i])) {
data[i] = element;
}
}
return data;
},


byTag =
function(tag, from) {
from || (from = doc);
if (lastContext !== from) { switchContext(from); }
return _byTag(tag, from);
},


byName =
function(name, from) {
return select('[name="' + name.replace(/\\([^\\]{1})/g, '$1') + '"]', from);
},


byClassRaw =
function(name, from) {
var i = -1, j = i, data = new global.Array(), element, elements = _byTag('*', from), n;
name = ' ' + (QUIRKS_MODE ? name.toLowerCase() : name).replace(/\\([^\\]{1})/g, '$1') + ' ';
while ((element = elements[++i])) {
n = XML_DOCUMENT ? element.getAttribute('class') : element.className;
if (n && n.length && (' ' + (QUIRKS_MODE ? n.toLowerCase() : n).
replace(reWhiteSpace, ' ') + ' ').indexOf(name) > -1) {
data[++j] = element;
}
}
return data;
},


_byClass =
function(name, from) {
return (BUGGY_GEBCN || BUGGY_QUIRKS_GEBCN || XML_DOCUMENT || !from.getElementsByClassName) ?
byClassRaw(name, from) : slice.call(from.getElementsByClassName(name.replace(/\\([^\\]{1})/g, '$1')), 0);
},


byClass =
function(name, from) {
from || (from = doc);
if (lastContext !== from) { switchContext(from); }
return _byClass(name, from);
},


contains = 'compareDocumentPosition' in root ?
function(container, element) {
return (container.compareDocumentPosition(element) & 16) == 16;
} : 'contains' in root ?
function(container, element) {
return container !== element && container.contains(element);
} :
function(container, element) {
while ((element = element.parentNode)) {
if (element === container) return true;
}
return false;
},


getAttribute = !BUGGY_GET_ATTRIBUTE ?
function(node, attribute) {
return node.getAttribute(attribute);
} :
function(node, attribute) {
attribute = attribute.toLowerCase();
if (typeof node[attribute] == 'object') {
return node.attributes[attribute] &&
node.attributes[attribute].value;
}
return (

attribute == 'type' ? node.getAttribute(attribute) :

ATTR_URIDATA[attribute] ? node.getAttribute(attribute, 2) :

ATTR_BOOLEAN[attribute] ? node.getAttribute(attribute) ? attribute : 'false' :
(node = node.getAttributeNode(attribute)) && node.value);
},


hasAttribute = !BUGGY_HAS_ATTRIBUTE ?
function(node, attribute) {
return XML_DOCUMENT ?
!!node.getAttribute(attribute) :
node.hasAttribute(attribute);
} :
function(node, attribute) {

var obj = node.getAttributeNode(attribute = attribute.toLowerCase());
return ATTR_DEFAULT[attribute] && attribute != 'value' ?
node[ATTR_DEFAULT[attribute]] : obj && obj.specified;
},


isEmpty =
function(node) {
node = node.firstChild;
while (node) {
if (node.nodeType == 3 || node.nodeName > '@') return false;
node = node.nextSibling;
}
return true;
},


isLink =
function(element) {
return hasAttribute(element,'href') && LINK_NODES[element.nodeName];
},


nthElement =
function(element, last) {
var count = 1, succ = last ? 'nextSibling' : 'previousSibling';
while ((element = element[succ])) {
if (element.nodeName > '@') ++count;
}
return count;
},


nthOfType =
function(element, last) {
var count = 1, succ = last ? 'nextSibling' : 'previousSibling', type = element.nodeName;
while ((element = element[succ])) {
if (element.nodeName == type) ++count;
}
return count;
},


configure =
function(option) {
if (typeof option == 'string') { return Config[option] || Config; }
if (typeof option != 'object') { return false; }
for (var i in option) {
Config[i] = !!option[i];
if (i == 'SIMPLENOT') {
matchContexts = new global.Object();
matchResolvers = new global.Object();
selectContexts = new global.Object();
selectResolvers = new global.Object();
if (!Config[i]) { Config['USE_QSAPI'] = false; }
} else if (i == 'USE_QSAPI') {
Config[i] = !!option[i] && NATIVE_QSAPI;
}
}
reValidator = new global.RegExp(Config.SIMPLENOT ?
standardValidator : extendedValidator, 'g');
return true;
},

emit =
function(message) {
if (Config.VERBOSITY) { throw new global.Error(message); }
if (global.console && global.console.log) {
global.console.log(message);
}
},
Config = new global.Object({

CACHING: false,



SHORTCUTS: false,


SIMPLENOT: true,


UNIQUE_ID: true,

USE_HTML5: true,

USE_QSAPI: NATIVE_QSAPI,

VERBOSITY: true
}),


ACCEPT_NODE = 'r[r.length]=c[k];if(f&&false===f(c[k]))break main;else continue main;',



compile =
function(selector, source, mode) {
var parts = typeof selector == 'string' ? selector.match(reSplitGroup) : selector;

typeof source == 'string' || (source = '');
if (parts.length == 1) {
source += compileSelector(parts[0], mode ? ACCEPT_NODE : 'f&&f(k);return true;', mode);
} else {

var i = -1, seen = new global.Object(), token;
while ((token = parts[++i])) {
token = token.replace(reTrimSpaces, '');


if (!seen[token] && (seen[token] = true)) {
source += compileSelector(token, mode ? ACCEPT_NODE : 'f&&f(k);return true;', mode);
}
}
}
if (mode) {

return new global.Function('c,s,r,d,h,g,f,v',
'var N,n,x=0,k=-1,e;main:while((e=c[++k])){' + source + '}return r;');
} else {

return new global.Function('e,s,r,d,h,g,f,v',
'var N,n,x=0,k=e;' + source + 'return false;');
}
},

FILTER =
'var z=v[@]||(v[@]=[]),l=z.length-1;' +
'while(l>=0&&z[l]!==e)--l;' +
'if(l!==-1){break;}' +
'z[z.length]=e;',


compileSelector =
function(selector, source, mode) {
var a, b, n, k = 0, expr, match, result, status, test, type;
while (selector) {
k++;


if ((match = selector.match(Patterns.universal))) {


expr = '';
}


else if ((match = selector.match(Patterns.id))) {


source = 'if(' + (XML_DOCUMENT ?
's.getAttribute(e,"id")' :
'(e.submit?s.getAttribute(e,"id"):e.id)') +
'=="' + match[1] + '"' +
'){' + source + '}';
}


else if ((match = selector.match(Patterns.tagName))) {


source = 'if(e.nodeName' + (XML_DOCUMENT ?
'=="' + match[1] + '"' : '.toUpperCase()' +
'=="' + match[1].toUpperCase() + '"') +
'){' + source + '}';
}


else if ((match = selector.match(Patterns.className))) {



source = 'if((n=' + (XML_DOCUMENT ?
's.getAttribute(e,"class")' : 'e.className') +
')&&n.length&&(" "+' + (QUIRKS_MODE ? 'n.toLowerCase()' : 'n') +
'.replace(' + reWhiteSpace + '," ")+" ").indexOf(" ' +
(QUIRKS_MODE ? match[1].toLowerCase() : match[1]) + ' ")>-1' +
'){' + source + '}';
}



else if ((match = selector.match(Patterns.attribute))) {

expr = match[1].split(':');
expr = expr.length == 2 ? expr[1] : expr[0] + '';
if (match[2] && !Operators[match[2]]) {
emit('Unsupported operator in attribute selectors "' + selector + '"');
return '';
}
test = 'false';

if (match[2] && match[4] && (test = Operators[match[2]])) {
match[4] = convertEscapes(match[4]);

HTML_TABLE['class'] = QUIRKS_MODE ? 1 : 0;
type = (XML_DOCUMENT ? XHTML_TABLE : HTML_TABLE)[expr.toLowerCase()];
test = test.replace(/\%m/g, type ? match[4].toLowerCase() : match[4]);
} else if (match[2] == '!=' || match[2] == '=') {
test = 'n' + match[2] + '=""';
}
source = 'if(n=s.hasAttribute(e,"' + match[1] + '")){' +
(match[2] ? 'n=s.getAttribute(e,"' + match[1] + '")' : '') +
(type && match[2] ? '.toLowerCase();' : ';') +
'if(' + (match[2] ? test : 'n') + '){' + source + '}}';
}


else if ((match = selector.match(Patterns.adjacent))) {
source = (mode ? '' : FILTER.replace(/@/g, k)) + source;
source = NATIVE_TRAVERSAL_API ?
'var N' + k + '=e;while(e&&(e=e.previousElementSibling)){' + source + 'break;}e=N' + k + ';' :
'var N' + k + '=e;while(e&&(e=e.previousSibling)){if(e.nodeName>"@"){' + source + 'break;}}e=N' + k + ';';
}


else if ((match = selector.match(Patterns.relative))) {
source = (mode ? '' : FILTER.replace(/@/g, k)) + source;
source = NATIVE_TRAVERSAL_API ?
('var N' + k + '=e;e=e.parentNode.firstElementChild;' +
'while(e&&e!==N' + k + '){' + source + 'e=e.nextElementSibling;}e=N' + k + ';') :
('var N' + k + '=e;e=e.parentNode.firstChild;' +
'while(e&&e!==N' + k + '){if(e.nodeName>"@"){' + source + '}e=e.nextSibling;}e=N' + k + ';');
}


else if ((match = selector.match(Patterns.children))) {
source = (mode ? '' : FILTER.replace(/@/g, k)) + source;
source = 'var N' + k + '=e;while(e&&e!==h&&e!==g&&(e=e.parentNode)){' + source + 'break;}e=N' + k + ';';
}


else if ((match = selector.match(Patterns.ancestor))) {
source = (mode ? '' : FILTER.replace(/@/g, k)) + source;
source = 'var N' + k + '=e;while(e&&e!==h&&e!==g&&(e=e.parentNode)){' + source + '}e=N' + k + ';';
}





else if ((match = selector.match(Patterns.spseudos)) && match[1]) {
switch (match[1]) {
case 'root':

if (match[3]) {
source = 'if(e===h||s.contains(h,e)){' + source + '}';
} else {
source = 'if(e===h){' + source + '}';
}
break;
case 'empty':

source = 'if(s.isEmpty(e)){' + source + '}';
break;
default:
if (match[1] && match[2]) {
if (match[2] == 'n') {
source = 'if(e!==h){' + source + '}';
break;
} else if (match[2] == 'even') {
a = 2;
b = 0;
} else if (match[2] == 'odd') {
a = 2;
b = 1;
} else {

b = ((n = match[2].match(/(-?\d+)$/)) ? global.parseInt(n[1], 10) : 0);
a = ((n = match[2].match(/(-?\d*)n/i)) ? global.parseInt(n[1], 10) : 0);
if (n && n[1] == '-') a = -1;
}


test = a > 1 ?
(/last/i.test(match[1])) ? '(n-(' + b + '))%' + a + '==0' :
'n>=' + b + '&&(n-(' + b + '))%' + a + '==0' : a < -1 ?
(/last/i.test(match[1])) ? '(n-(' + b + '))%' + a + '==0' :
'n<=' + b + '&&(n-(' + b + '))%' + a + '==0' : a === 0 ?
'n==' + b : a == -1 ? 'n<=' + b : 'n>=' + b;

source =
'if(e!==h){' +
'n=s[' + (/-of-type/i.test(match[1]) ? '"nthOfType"' : '"nthElement"') + ']' +
'(e,' + (/last/i.test(match[1]) ? 'true' : 'false') + ');' +
'if(' + test + '){' + source + '}' +
'}';
} else {

a = /first/i.test(match[1]) ? 'previous' : 'next';
n = /only/i.test(match[1]) ? 'previous' : 'next';
b = /first|last/i.test(match[1]);
type = /-of-type/i.test(match[1]) ? '&&n.nodeName!=e.nodeName' : '&&n.nodeName<"@"';
source = 'if(e!==h){' +
( 'n=e;while((n=n.' + a + 'Sibling)' + type + ');if(!n){' + (b ? source :
'n=e;while((n=n.' + n + 'Sibling)' + type + ');if(!n){' + source + '}') + '}' ) + '}';
}
break;
}
}





else if ((match = selector.match(Patterns.dpseudos)) && match[1]) {
switch (match[1].match(/^\w+/)[0]) {

case 'not':



expr = match[3].replace(reTrimSpaces, '');
if (Config.SIMPLENOT && !reSimpleNot.test(expr)) {

emit('Negation pseudo-class only accepts simple selectors "' + selector + '"');
return '';
} else {
if ('compatMode' in doc) {
source = 'if(!' + compile(expr, '', false) + '(e,s,r,d,h,g)){' + source + '}';
} else {
source = 'if(!s.match(e, "' + expr.replace(/\x22/g, '\\"') + '",g)){' + source +'}';
}
}
break;

case 'checked':

source = 'if((typeof e.form!=="undefined"&&(/^(?:radio|checkbox)$/i).test(e.type)&&e.checked)' +
(Config.USE_HTML5 ? '||(/^option$/i.test(e.nodeName)&&(e.selected||e.checked))' : '') +
'){' + source + '}';
break;
case 'disabled':

source = 'if(((typeof e.form!=="undefined"' +
(Config.USE_HTML5 ? '' : '&&!(/^hidden$/i).test(e.type)') +
')||s.isLink(e))&&e.disabled===true){' + source + '}';
break;
case 'enabled':

source = 'if(((typeof e.form!=="undefined"' +
(Config.USE_HTML5 ? '' : '&&!(/^hidden$/i).test(e.type)') +
')||s.isLink(e))&&e.disabled===false){' + source + '}';
break;

case 'lang':
test = '';
if (match[2]) test = match[2].substr(0, 2) + '-';
source = 'do{(n=e.lang||"").toLowerCase();' +
'if((n==""&&h.lang=="' + match[2].toLowerCase() + '")||' +
'(n&&(n=="' + match[2].toLowerCase() +
'"||n.substr(0,3)=="' + test.toLowerCase() + '")))' +
'{' + source + 'break;}}while((e=e.parentNode)&&e!==g);';
break;

case 'target':
source = 'if(e.id==d.location.hash.slice(1)){' + source + '}';
break;

case 'link':
source = 'if(s.isLink(e)&&!e.visited){' + source + '}';
break;
case 'visited':
source = 'if(s.isLink(e)&&e.visited){' + source + '}';
break;


case 'active':
if (XML_DOCUMENT) break;
source = 'if(e===d.activeElement){' + source + '}';
break;
case 'hover':
if (XML_DOCUMENT) break;
source = 'if(e===d.hoverElement){' + source + '}';
break;
case 'focus':
if (XML_DOCUMENT) break;
source = NATIVE_FOCUS ?
'if(e===d.activeElement&&d.hasFocus()&&(e.type||e.href||typeof e.tabIndex=="number")){' + source + '}' :
'if(e===d.activeElement&&(e.type||e.href)){' + source + '}';
break;


case 'selected':

expr = BUGGY_SELECTED ? '||(n=e.parentNode)&&n.options[n.selectedIndex]===e' : '';
source = 'if(/^option$/i.test(e.nodeName)&&(e.selected||e.checked' + expr + ')){' + source + '}';
break;
default:
break;
}
}
else {


expr = false;
status = false;
for (expr in Selectors) {
if ((match = selector.match(Selectors[expr].Expression)) && match[1]) {
result = Selectors[expr].Callback(match, source);
source = result.source;
status = result.status;
if (status) { break; }
}
}


if (!status) {


emit('Unknown pseudo-class selector "' + selector + '"');
return '';
}
if (!expr) {

emit('Unknown token in selector "' + selector + '"');
return '';
}
}

if (!match) {
emit('Invalid syntax in selector "' + selector + '"');
return '';
}


selector = match && match[match.length - 1];
}
return source;
},



match =
function(element, selector, from, callback) {
var parts;
if (!(element && element.nodeType == 1)) {
emit('Invalid element argument');
return false;
} else if (typeof selector != 'string') {
emit('Invalid selector argument');
return false;
} else if (from && from.nodeType == 1 && !contains(from, element)) {
return false;
} else if (lastContext !== from) {


switchContext(from || (from = element.ownerDocument));
}
selector = selector.replace(reTrimSpaces, '');
Config.SHORTCUTS && (selector = Dom.shortcuts(selector, element, from));
if (lastMatcher != selector) {

if ((parts = selector.match(reValidator)) && parts[0] == selector) {
isSingleMatch = (parts = selector.match(reSplitGroup)).length < 2;

lastMatcher = selector;
lastPartsMatch = parts;
} else {
emit('The string "' + selector + '", is not a valid CSS selector');
return false;
}
} else parts = lastPartsMatch;

if (!matchResolvers[selector] || matchContexts[selector] !== from) {
matchResolvers[selector] = compile(isSingleMatch ? [selector] : parts, '', false);
matchContexts[selector] = from;
}
return matchResolvers[selector](element, Snapshot, [ ], doc, root, from, callback, new global.Object());
},


first =
function(selector, from) {
return select(selector, from, function() { return false; })[0] || null;
},




select =
function(selector, from, callback) {
var i, changed, element, elements, parts, token, original = selector;
if (arguments.length === 0) {
emit('Not enough arguments');
return [ ];
} else if (typeof selector != 'string') {
return [ ];
} else if (from && !(/1|9|11/).test(from.nodeType)) {
emit('Invalid or illegal context element');
return [ ];
} else if (lastContext !== from) {


switchContext(from || (from = doc));
}
if (Config.CACHING && (elements = Dom.loadResults(original, from, doc, root))) {
return callback ? concatCall([ ], elements, callback) : elements;
}
if (!OPERA_QSAPI && RE_SIMPLE_SELECTOR.test(selector)) {
switch (selector.charAt(0)) {
case '#':
if (Config.UNIQUE_ID) {
elements = (element = _byId(selector.slice(1), from)) ? [ element ] : [ ];
}
break;
case '.':
elements = _byClass(selector.slice(1), from);
break;
default:
elements = _byTag(selector, from);
break;
}
}
else if (!XML_DOCUMENT && Config.USE_QSAPI &&
!(BUGGY_QUIRKS_QSAPI && RE_CLASS.test(selector)) &&
!RE_BUGGY_QSAPI.test(selector)) {
try {
elements = from.querySelectorAll(selector);
} catch(e) { }
}
if (elements) {
elements = callback ? concatCall([ ], elements, callback) :
NATIVE_SLICE_PROTO ? slice.call(elements) : concatList([ ], elements);
Config.CACHING && Dom.saveResults(original, from, doc, elements);
return elements;
}
selector = selector.replace(reTrimSpaces, '');
Config.SHORTCUTS && (selector = Dom.shortcuts(selector, from));
if ((changed = lastSelector != selector)) {

if ((parts = selector.match(reValidator)) && parts[0] == selector) {
isSingleSelect = (parts = selector.match(reSplitGroup)).length < 2;

lastSelector = selector;
lastPartsSelect = parts;
} else {
emit('The string "' + selector + '", is not a valid CSS selector');
return [ ];
}
} else parts = lastPartsSelect;

if (from.nodeType == 11) {
elements = byTagRaw('*', from);
} else if (!XML_DOCUMENT && isSingleSelect) {
if (changed) {

parts = selector.match(reSplitToken);
token = parts[parts.length - 1];

lastSlice = token.split(':not')[0];

lastPosition = selector.length - token.length;
}

if (Config.UNIQUE_ID && (parts = lastSlice.match(Optimize.ID)) && (token = parts[1])) {
if ((element = _byId(token, from))) {
if (match(element, selector)) {
callback && callback(element);
elements = new global.Array(element);
} else elements = new global.Array();
}
}

else if (Config.UNIQUE_ID && (parts = selector.match(Optimize.ID)) && (token = parts[1])) {
if ((element = _byId(token, doc))) {
if ('#' + token == selector) {
callback && callback(element);
elements = new global.Array(element);
} else if (/[>+~]/.test(selector)) {
from = element.parentNode;
} else {
from = element;
}
} else elements = new global.Array();
}
if (elements) {
Config.CACHING && Dom.saveResults(original, from, doc, elements);
return elements;
}
if (!NATIVE_GEBCN && (parts = lastSlice.match(Optimize.TAG)) && (token = parts[1])) {
if ((elements = _byTag(token, from)).length === 0) { return [ ]; }
selector = selector.slice(0, lastPosition) + selector.slice(lastPosition).replace(token, '*');
}
else if ((parts = lastSlice.match(Optimize.CLASS)) && (token = parts[1])) {
if ((elements = _byClass(token, from)).length === 0) { return [ ]; }
if (reOptimizeSelector.test(selector.charAt(selector.indexOf(token) - 1))) {
selector = selector.slice(0, lastPosition) + selector.slice(lastPosition).replace('.' + token, '');
} else {
selector = selector.slice(0, lastPosition) + selector.slice(lastPosition).replace('.' + token, '*');
}
}
else if ((parts = selector.match(Optimize.CLASS)) && (token = parts[1])) {
if ((elements = _byClass(token, from)).length === 0) { return [ ]; }
for (i = 0, els = new global.Array(); elements.length > i; ++i) {
els = concatList(els, elements[i].getElementsByTagName('*'));
}
elements = els;
if (reOptimizeSelector.test(selector.charAt(selector.indexOf(token) - 1))) {
selector = selector.slice(0, lastPosition) + selector.slice(lastPosition).replace('.' + token, '');
} else {
selector = selector.slice(0, lastPosition) + selector.slice(lastPosition).replace('.' + token, '*');
}
}
else if (NATIVE_GEBCN && (parts = lastSlice.match(Optimize.TAG)) && (token = parts[1])) {
if ((elements = _byTag(token, from)).length === 0) { return [ ]; }
selector = selector.slice(0, lastPosition) + selector.slice(lastPosition).replace(token, '*');
}
}
if (!elements) {
elements = /^(?:applet|object)$/i.test(from.nodeName) ? from.childNodes : _byTag('*', from);
}


if (!selectResolvers[selector] || selectContexts[selector] !== from) {
selectResolvers[selector] = compile(isSingleSelect ? [selector] : parts, '', true);
selectContexts[selector] = from;
}
elements = selectResolvers[selector](elements, Snapshot, [ ], doc, root, from, callback, new global.Object());
Config.CACHING && Dom.saveResults(original, from, doc, elements);
return elements;
},


FN = function(x) { return x; },

matchContexts = new global.Object(),
matchResolvers = new global.Object(),

selectContexts = new global.Object(),
selectResolvers = new global.Object(),

Snapshot = new global.Object({

nthElement: nthElement,
nthOfType: nthOfType,

getAttribute: getAttribute,
hasAttribute: hasAttribute,

byClass: _byClass,
byName: byName,
byTag: _byTag,
byId: _byId,

contains: contains,
isEmpty: isEmpty,
isLink: isLink,

select: select,
match: match
}),
Tokens = new global.Object({
prefixes: prefixes,
encoding: encoding,
operators: operators,
whitespace: whitespace,
identifier: identifier,
attributes: attributes,
combinators: combinators,
pseudoclass: pseudoclass,
pseudoparms: pseudoparms,
quotedvalue: quotedvalue
});


Dom.ACCEPT_NODE = ACCEPT_NODE;

Dom.byId = byId;

Dom.byTag = byTag;

Dom.byName = byName;

Dom.byClass = byClass;


Dom.getAttribute = getAttribute;


Dom.hasAttribute = hasAttribute;

Dom.match = match;

Dom.first = first;

Dom.select = select;

Dom.compile = compile;

Dom.contains = contains;

Dom.configure = configure;

Dom.setCache = FN;

Dom.loadResults = FN;

Dom.saveResults = FN;

Dom.shortcuts = FN;

Dom.emit = emit;

Dom.Config = Config;

Dom.Snapshot = Snapshot;


Dom.Operators = Operators;


Dom.Selectors = Selectors;

Dom.Tokens = Tokens;

Dom.Version = version;

Dom.registerOperator =
function(symbol, resolver) {
Operators[symbol] || (Operators[symbol] = resolver);
};

Dom.registerSelector =
function(name, rexp, func) {
Selectors[name] || (Selectors[name] = new global.Object({
Expression: rexp,
Callback: func
}));
};


switchContext(doc, true);
});
}
,
function(exports,require){

var findELEnd=require(38).findELEnd;
var parseChildRemoveAttr=require(39).parseChildRemoveAttr;
var compressJS=require(40).compressJS;
var findXMLAttribute=require(8).findXMLAttribute;
var XML_SPACE_TRIM=require(12).XML_SPACE_TRIM;

var AUTO_FORM_PREFIX = "http://www.xidea.org/lite/attribute/h:autofrom" 
var AUTO_FORM_SELETED = "http://www.xidea.org/lite/attribute/h:autofrom#selected"
var WRAP_SCRIPT_USE = "http://www.xidea.org/lite/attribute/h:wrap_script_use"
var HTML = {
xmlns : function(){},

parse$8:parseConditionComment,

parseSelect:parseSelect,
parseOption:parseOption,
parseInput:parseInput,
parseTextArea:parseTextArea,

parseScript : parseHtmlScript,
parseHead:parseHtmlHead,
parseHtml:parseHtml,
parseLink:parseLink,

parsePre : preservedParse,


"onon*":parseHtmlEventAttr,



onhref:autoURIEncoder,

onaction:autoURIEncoder,


onsrc:autoURIEncoder,
}
var HTML_EXT = {
xmlns : function(){},
interceptAutoform:interceptAutoform,
interceptTrim:interceptTrim,
parseAutoform:interceptAutoform,
parseTrim:interceptTrim,
}
exports.HTML=HTML;
exports.HTML_EXT=HTML_EXT;
exports.wrapScript = wrapScript;

function parseHtmlHead(head){
this.setAttribute(parseHtmlHead,true);
var doc = head.ownerDocument;
head.appendChild(doc.createTextNode('$!{__head_styles__}'));
this.next(head);
this.setAttribute(parseHtmlHead,undefined);
}
function parseHtml(html){
var mark = this.mark();
var links = [];
this.setAttribute(parseHtml,links)
this.next(html);
var result = this.reset(mark);
this.appendCapture('__head_styles__');
this.setAttribute(parseHtmlHead,true)
for(var i = 0;i<links.length;i++){
this.parse(links[i]);
}
this.setAttribute(parseHtmlHead,undefined)
this.appendEnd();
this.appendAll(result);

}
function parseLink(link){
var list = this.getAttribute(parseHtml)
if(list && !this.getAttribute(parseHtmlHead)){
list.push(link)
}else{
this.next(link);
}

}
function parseInput(el){
var autoform = this.getAttribute(AUTO_FORM_PREFIX);
if(autoform!=null){
var name_ = el.getAttribute('name');

if(name_){
var type = el.getAttribute('type');
if(!/^(?:reset|button|submit)$/i.test(type)){
if(/^(?:checkbox|radio)$/i.test(type)){
if(!el.hasAttribute('checked')){
buildCheck2select(this,el,name_,'checked',/checkbox/i.test(type));
return ;
}
}else if(!el.hasAttribute('value')){
el.setAttribute('value', "${"+name_+"}");
}
}
}
}
this.next(el);
}
function parseTextArea(el){
var oldSpace = this.getAttribute(XML_SPACE_TRIM);
this.setAttribute(XML_SPACE_TRIM,false);
var autoform = this.getAttribute(AUTO_FORM_PREFIX);
var hasValue = el.hasAttribute('value');
if(hasValue){
el.textContent = el.getAttribute('value');
}else if(autoform!=null && !el.hasChildNodes()){
var name_ = el.getAttribute('name');
el.textContent = "${"+ name_ + "}";
}
this.next(el);
this.setAttribute(XML_SPACE_TRIM,oldSpace);
}
function parseSelect(el){
var multiple = el.hasAttribute('multiple');
this.setAttribute(AUTO_FORM_SELETED,[el.getAttribute('name'),multiple]);
this.next(el);
}
function parseOption(el){
var autoform = this.getAttribute(AUTO_FORM_PREFIX);
if(autoform!=null){
var name_multiple = this.getAttribute(AUTO_FORM_SELETED);
if(name_multiple){
buildCheck2select(this,el,name_multiple[0],'selected',name_multiple[1]);
return;
}
}
this.next(el);
}
function interceptAutoform(node){
var oldAutoform = this.getAttribute(AUTO_FORM_PREFIX);
try{
var prefix = findXMLAttribute(node,'*value');

if(prefix == 'true'){
prefix = '';
}
this.setAttribute(AUTO_FORM_PREFIX,prefix);
parseChildRemoveAttr(this,node);
}finally{
this.setAttribute(AUTO_FORM_PREFIX,oldAutoform);
}
}

function parseConditionComment(comm){
var text = comm.textContent || comm.data;
var match = text.match(/^\[if\s[^\]]+\]>|<!\[endif\]$/ig);
if(match){
if(match.length == 1){
this.appendText('<!--'+text+'-->')
}else{
var len1 = match[0].length;
var len2 = match[1].length
var content = text.substring(len1,text.length - len2);
try{
if(/^\s*</.test(content)){
content = this.loadXML(content);
}

}catch(e){
}
this.appendText('<!--'+match[0]);
this.parse(content);
this.appendText(match[1]+'-->');
}
}
}

function interceptTrim(node){
var oldSpace = this.getAttribute(XML_SPACE_TRIM);
try{
var value = findXMLAttribute(node,'*value');
this.setAttribute(XML_SPACE_TRIM,value == 'true'?true:value == 'false'?false:null);

parseChildRemoveAttr(this,node);
}finally{
this.setAttribute(XML_SPACE_TRIM,oldSpace);
}
}
function toelv(value){
if(value){
var elv = value.replace(/^\$\{([\s\S]+)\}$/,'$1');
try{
if(elv != value){
new Function("return "+elv);
}
}catch(e){
elv = value;
}
if(elv == value){
elv = JSON.stringify(value);
}
}
return elv;
}
function buildCheck2select(context,el,name_,checkName,multiple){
var value = el.getAttribute('value');
if(!value && checkName == 'selected'){
value = el.textContent;
}
var elv = toelv(value);
if(!elv){
context.next(el);
return;
}
var forId = context.allocateId();
var flag = context.allocateId();
if(multiple){
context.appendVar(flag,'true');
context.appendFor(forId,"[].concat("+name_+')',null);
context.appendIf(flag +'&&'+ forId+'+""===""+'+elv);
el.setAttribute(checkName,checkName);
context.appendVar(flag,'false');
context.next(el)
context.appendEnd();
context.appendEnd();
context.appendIf(flag);
el.removeAttribute(checkName);
context.next(el)
context.appendEnd();
}else{
context.appendIf(name_+'+""===""+'+elv);
el.setAttribute(checkName,checkName);
context.next(el);
context.appendEnd();
context.appendElse(null);
el.removeAttribute(checkName);
context.next(el);
context.appendEnd();
}
}

function preservedParse(node){
var oldSpace = this.getAttribute(XML_SPACE_TRIM);
this.setAttribute(XML_SPACE_TRIM,false);
try{
this.next(node);
}finally{
this.setAttribute(XML_SPACE_TRIM,oldSpace);
}
}
function parseHtmlScript(el){
var oldSpace = this.getAttribute(XML_SPACE_TRIM);
this.setAttribute(XML_SPACE_TRIM,false);
try{
if(!el.hasAttribute('src')){
var doc = el.ownerDocument;
var wrap_script = this.getAttribute(WRAP_SCRIPT_USE);
var child;
var buf = [];
while(child = el.firstChild){
if(child.nodeType==3 || child.nodeType == 4){
buf.push(child.data);
}else{
console.warn('script 中不能用嵌入html标签，建议将脚本放在 <![CDATA[...]]>中。');
}
el.removeChild(child);
}
var source = processJS(this,buf.join(''));
if(wrap_script){
wrapScript(source,wrap_script)
}
if(source.search(/[<&]/)>=0){
el.appendChild(doc.createTextNode('/*'));
el.appendChild(doc.createCDATASection('*/'+source+'//'));
}else{
el.appendChild(doc.createTextNode(source));
}
}
this.next(el);
}finally{
this.setAttribute(XML_SPACE_TRIM,oldSpace);
}
}
function wrapScript(source,wrap_script_method){
var callMatch = source.match(/^\s*([\w\.]+)\(([\s\S]*)\)\s*;?\s*$/);
var callMethod = callMatch && callMatch[1];
if(!/^(?:__define_run__|(?:\w+\.)?use)$/.test(callMethod)){
var rexp = /\brequire\((['"][\.\-\w@\/]+["'])\)|^\s*\/(?:\/.*|\*[\s\S]*?\*\/)|'(?:[^'\\\r\n]|\\.)*'|"(?:[^"\\\r\n]|\\.)*"/g;
var deps = [];
var m;
while(m = rexp.exec(source)){
m[1] && deps.push(m[1]);
}

source = wrap_script_method + '(['+deps.join(',')+'],function(){'+source+'\n})'

}
return source;
}
function parseHtmlEventAttr(attr){
attr.value = processJS(this,attr.value);
this.next(attr);
}
function processJS(ctx,value){
var value2 = value.replace(/^\s*\$\{([\s\S]+)\}\s*$/,'return $1');
if(value2 != value){
try{
new Function(value2);

return value;
}catch(e){
}
}
value = compressJS(value);
return autoEncode(value,/^\s*JSON\s*\.\s*stringify\s*\(/,replaceJSON);
}
function replaceJSON(v){
return "JSON.stringify("+v+")";
}
function replaceURI(v){
return "encodeURI("+v+")";
}
function autoURIEncoder(attr){
var value = attr.value;
attr.value = autoEncode(value,/^\s*encodeURI\s*\(/,replaceURI,encodeURI);
this.next(attr);
}

function autoEncode(value,pattern,elReplacer,staticReplacer){
var p = -1;
var result = [];
while(true){
p = value.indexOf("${",++p);
if(p>=0){
if(!(countEescape(value,p) % 2)){
var p2 = findELEnd(value,p+1);
if(p2>0){
var el = value.substring(p+2,p2);
if(!pattern.test(el)){
el = elReplacer(el);
}
var prefix = value.substring(0,p);
if(staticReplacer){
prefix = staticReplacer(prefix);
}
result.push(prefix,'${',el,'}');
value = value.substring(p2+1)
p=-1;
}else{
p++;
}
}
}else{
break;
}
}
if(staticReplacer){
value = staticReplacer(value);
}
if(result.length){
result.push(value);
return result.join('');
}else{
return value;
}
}
function countEescape(text, p$) {
if (p$ > 0 && text.charAt(p$ - 1) == '\\') {
var pre = p$ - 1;
while (pre-- > 0 && text.charAt(pre) == '\\')
;
return p$ - pre - 1;
}
return 0;
}

}
,
function(exports,require){
var appendForStart = require(39).appendForStart;
var parseChildRemoveAttr=require(39).parseChildRemoveAttr;
var findLiteParamMap=require(39).findLiteParamMap;
var parseDefName = require(39).parseDefName;
var setNodeURI = require(39).setNodeURI;
var findELEnd=require(38).findELEnd;
var querySelectorAll = require(8).querySelectorAll;
var selectByXPath=require(8).selectByXPath;
var findXMLAttribute=require(8).findXMLAttribute;
var findXMLAttributeAsEL=require(8).findXMLAttributeAsEL;
var URI=require(7).URI;
var PLUGIN_DEFINE=require(14).PLUGIN_DEFINE;
var EL_TYPE=require(14).EL_TYPE;
var XT_TYPE = require(14).XT_TYPE;
var XA_TYPE = require(14).XA_TYPE;
var CHOOSE_KEY = "http://www.xidea.org/lite/core/c:choose@value";
var Core = {
xmlns : function(){},
parseExtension:function(node){
var ns = findXMLAttribute(node,'*namespace','ns');
var file = findXMLAttribute(node,'file');
var pkg = findXMLAttribute(node,'package');
if(pkg){
source = pkg;
}else if(file){
var source = this.loadText(this.createURI(file))+'\n';
}else{
var source = findXMLAttribute(node,'#text')+'\n';
}
this.addExtension(ns,source);
},
parseComment:function(){},
seek:function(text){
var end = findELEnd(text,0);
if(end>0){
try{
var els = text.substring(1,end);
var el = this.parseEL(els);
switch(this.textType){
case XT_TYPE:
this.appendXT(el);
break;
case XA_TYPE:
this.appendXA(null,el);
break;
default:
this.appendEL(el);
}
return end;
}catch(e){
console.error("表达式解析异常，请检查是否手误：[fileName:"+this.currentURI+",el:"+els+"]",e)
return -1;
}
}else{
console.warn("表达式解析异常，请检查是否手误：[fileName:"+this.currentURI+",text:"+text+"]")
return -1;
}
},
"seek!":function(text){
var end = findELEnd(text,0);
if(end>0){
try{
var el = text.substring(1,end);
this.appendEL(el);
return end;
}catch(e){
console.error("表达式解析异常，请检查是否手误：[fileName:"+this.currentURI+",el:"+el+"]",e)
return -1;
}
}else{
console.warn("表达式解析异常，请检查是否手误：[fileName:"+this.currentURI+",el:"+el+"]")
return -1;
}
},
"seek#":function(text){
var end = findELEnd(text,0);
if(end>0){
try{
var el = text.substring(1,end);
this.appendPlugin("org.xidea.lite.EncodePlugin","{}");
this.appendEL(el);
this.appendEnd()
return end;
}catch(e){
console.error("表达式解析异常，请检查是否手误：[fileName:"+this.currentURI+",el:"+el+"]",e)
return -1;
}
}else{
console.warn("表达式解析异常，请检查是否手误：[fileName:"+this.currentURI+",el:"+el+"]")
return -1;
}
},

parseDateFormat:function(node){
var value = findXMLAttributeAsEL(node,'value','date','time','#text').replace(/^\s+|\s+$/g,'') || 'null';
var pattern = findXMLAttribute(node,'pattern');
if(pattern){
var pattern2 = pattern.replace(/^\s*\$\{([\s\S]+)\}\s*$/,'$1')
if(pattern2 == pattern){
pattern2 = JSON.stringify(pattern);
}
}else{
pattern2 = '"YYYY-MM-DD"';
}
this.appendPlugin("org.xidea.lite.DatePlugin","{}");
this.appendEL(pattern2);
this.appendEL(value);
this.appendEnd();
}
}
exports.Core=Core;
Core.parseTime = Core.parseDate = Core.parseDateFormat;
addParserAndAttrInterceptor(processIf,'if')
addParserAndAttrInterceptor(processElse,'else');
addParserAndAttrInterceptor(processElif,"elseif","elif");
addParserAndAttrInterceptor(processFor,"for","foreach");
addParserAndAttrInterceptor(processVar,"var","set");
addParserAndAttrInterceptor(processOut,"out");
addParserAndAttrInterceptor(processDef,"def",'macro');
addParserAndAttrInterceptor(processClient,"client");
addParserAndAttrInterceptor(processChoose,"choose");
addParserAndAttrInterceptor(processWhen,"when");
addParserAndAttrInterceptor(processOtherwise,"otherwise");
addParserAndAttrInterceptor(processInclude,"include");
function addParserAndAttrInterceptor(processor){
var i = arguments.length;
while(--i>0){
var n = arguments[i];
Core['parse'+n]=Core['intercept'+n]=processor;
}
}

function processIf(node){
var test = findXMLAttributeAsEL(node,'*test','value');
this.appendIf(test);
parseChildRemoveAttr(this,node);
this.appendEnd();
}
function processElse(node){
var test = findXMLAttributeAsEL(node,'test','value');
this.appendElse(test || null);
parseChildRemoveAttr(this,node);
this.appendEnd();
}
function processElif(node){
var test = findXMLAttributeAsEL(node,'*test','value');
this.appendElse(test || null);
parseChildRemoveAttr(this,node);
this.appendEnd();
}
function processChoose(node){
var value = findXMLAttributeAsEL(node,"value","test");
var oldStatus = this.getAttribute(CHOOSE_KEY);
this.setAttribute(CHOOSE_KEY,{value:value,first:true});
parseChildRemoveAttr(this,node,true);
this.setAttribute(CHOOSE_KEY,oldStatus);
}
function processWhen(node){
var stat = this.getAttribute(CHOOSE_KEY);
var value = findXMLAttributeAsEL(node,"*test","if","value");
if(stat.value){
value = '('+stat.value + ')==('+value+')';
}
if(stat.first){
stat.first = false;
this.appendIf(value);
}else{
this.appendElse(value);
}
parseChildRemoveAttr(this,node);
this.appendEnd();
}
function processOtherwise(node){
this.appendElse(null);
parseChildRemoveAttr(this,node);
this.appendEnd();
}
function processFor(node){
if(node.nodeType == 1){
var list = findXMLAttributeAsEL(node,'*list','values','items','value');
var var_ = findXMLAttribute(node,'*var','name','id','item');
var status_ = findXMLAttribute(node,'status');
}else{
var var_ = findXMLAttribute(node).replace(/\s*\$\{([\s\S]*)\}\s*$/,'$1');
}
appendForStart(this,var_,list,status_ || null);
parseChildRemoveAttr(this,node);
this.appendEnd();
}
function processVar(node){
var name_ = findXMLAttribute(node,'*name','id');
if(node.nodeType == 1){
var value = findXMLAttribute(node,'value');
if(value){
var code = this.parseText(value,0);
if(code.length == 1){
code = code[0];
if(code instanceof Array){
this.appendVar(name_,code[1]);
}else{
console.warn("标签:"+node.tagName+"的value属性"+value+"建议设置为表达式，您的输入没有表达式，系统自动按静态文本处理");
this.appendVar(name_,JSON.stringify(code));
}
}else{
this.appendCapture(name_);
this.appendAll(code)
this.appendEnd();
}
}else{
this.appendCapture(name_);
parseChildRemoveAttr(this,node);
this.appendEnd();
}
}else{
var map = findLiteParamMap(name_);
if(map){
for(var n in map){
this.appendVar(n,map[n]);
}
parseChildRemoveAttr(this,node);
}else{
this.appendCapture(name_);
parseChildRemoveAttr(this,node);
this.appendEnd();
}
}
}
function processOut(node){
var value = findXMLAttribute(node,"value","#text");
value = this.parseText(value,EL_TYPE);
this.appendAll(value);
if(node.nodeType == 2){
console.error(' c:out attribute is unsafe!!');
}
}
function processDef(node){
var ns = findXMLAttribute(node,'*name');
var config = parseDefName(ns);
this.appendPlugin(PLUGIN_DEFINE,JSON.stringify(config));
parseChildRemoveAttr(this,node);
this.appendEnd();
}
function processClient(node){
var name_ = findXMLAttribute(node,'*name','id');
var config = parseDefName(name_);
this.appendText("<script>//<![CDATA[\n");
this.appendPlugin("org.xidea.lite.parse.ClientPlugin",JSON.stringify(config));
parseChildRemoveAttr(this,node);
this.appendEnd();
this.appendText("//]]></script>")
}
function processInclude(node){
if(node.nodeType == 1){
_parseInclude.apply(this,arguments);
}else if(node.nodeType == 2){
_interceptInclude.apply(this,arguments);
}
}
function _parseInclude(node){
var path = findXMLAttribute(node,'path');
var xpath = findXMLAttribute(node,'xpath');
var selector = findXMLAttribute(node,'selector');
var parentURI = this.currentURI;
try{
if(path!=null){
if(path.charAt() == '#'){
console.warn("装饰器命名节点改用${pageName}模式了:(,您实用的模式还是:"+path);
path = '$'+path.substring(1);
}
if(path.charAt() == '$'){
doc = this.getAttribute(path);
setNodeURI(this,node);
}else{
var uri = this.createURI(path);
var doc = this.loadXML(uri);
this.setCurrentURI(uri);
}
}else{
var doc = this.loadXML(this.currentURI);
var doc = node.ownerDocument
}
if(doc==null){
this.appendText("<strong style='color:red'>没找到包含节点："+this.currentURI+ node.value+"</strong>");
}else{
if(selector != null){
var list = querySelectorAll.apply(doc,selector);;
if(list && list.length){
for(var i=0;i<list.length;i++){
this.parse(list[i])
}
}else{
console.warn("empty selection:"+selector)
}
}else if(xpath!=null){
var d = doc;
doc = selectByXPath(doc,xpath);

}
this.parse(doc)
}
}finally{
this.setCurrentURI(parentURI);
}
}
function _interceptInclude(attr){
var match = attr.value.match(/^([^#]*)(?:#(.*))?$/);
var path = match[1];
var xpath = match[2];
if(path){
var path2 = path.replace(/^[\$#]([\w\$_]+)$/,'$$$1');
if(path2.charAt() == '$') {
doc = this.getAttribute(path2);
}else{
var uri = this.createURI(path);
var doc = this.loadXML(uri)

}
}else{
var doc = attr.ownerDocument;
}
if(doc==null){
this.appendText("<strong style='color:red'>没找到包含节点："+this.currentURI+ attr.value+"</strong>");
}else{
var attrs = selectByXPath(doc, xpath);
var element = attr.ownerElement || attr.selectSingleNode('..');

for(var i = attrs.length;i--;){
var a = attrs.item(i);
_mergeAttribute(element,a);
}
}
parseChildRemoveAttr(this,attr);

}
function _mergeAttribute(element,node){
if(node.nodeType == 2){
var attr = element.getAttributeNS(node.namespaceURI,node.name);
element.setAttributeNS(node.namespaceURI,node.name,attr+node.value);
}else if(node.nodeType == 1){
var attributes = node.attributes;
for (var i = 0; i < attributes.length; i++) {
_mergeAttribute(element,attributes.item(i));
}
}
}
}
,
function(exports,require,module){

XPathParser.prototype = new Object();
XPathParser.prototype.constructor = XPathParser;
XPathParser.superclass = Object.prototype;
function XPathParser() {
this.init();
}
XPathParser.prototype.init = function() {
this.reduceActions = [];
this.reduceActions[3] = function(rhs) {
return new OrOperation(rhs[0], rhs[2]);
};
this.reduceActions[5] = function(rhs) {
return new AndOperation(rhs[0], rhs[2]);
};
this.reduceActions[7] = function(rhs) {
return new EqualsOperation(rhs[0], rhs[2]);
};
this.reduceActions[8] = function(rhs) {
return new NotEqualOperation(rhs[0], rhs[2]);
};
this.reduceActions[10] = function(rhs) {
return new LessThanOperation(rhs[0], rhs[2]);
};
this.reduceActions[11] = function(rhs) {
return new GreaterThanOperation(rhs[0], rhs[2]);
};
this.reduceActions[12] = function(rhs) {
return new LessThanOrEqualOperation(rhs[0], rhs[2]);
};
this.reduceActions[13] = function(rhs) {
return new GreaterThanOrEqualOperation(rhs[0], rhs[2]);
};
this.reduceActions[15] = function(rhs) {
return new PlusOperation(rhs[0], rhs[2]);
};
this.reduceActions[16] = function(rhs) {
return new MinusOperation(rhs[0], rhs[2]);
};
this.reduceActions[18] = function(rhs) {
return new MultiplyOperation(rhs[0], rhs[2]);
};
this.reduceActions[19] = function(rhs) {
return new DivOperation(rhs[0], rhs[2]);
};
this.reduceActions[20] = function(rhs) {
return new ModOperation(rhs[0], rhs[2]);
};
this.reduceActions[22] = function(rhs) {
return new UnaryMinusOperation(rhs[1]);
};
this.reduceActions[24] = function(rhs) {
return new BarOperation(rhs[0], rhs[2]);
};
this.reduceActions[25] = function(rhs) {
return new PathExpr(undefined, undefined, rhs[0]);
};
this.reduceActions[27] = function(rhs) {
rhs[0].locationPath = rhs[2];
return rhs[0];
};
this.reduceActions[28] = function(rhs) {
rhs[0].locationPath = rhs[2];
rhs[0].locationPath.steps.unshift(new Step(Step.DESCENDANTORSELF, new NodeTest(NodeTest.NODE, undefined), []));
return rhs[0];
};
this.reduceActions[29] = function(rhs) {
return new PathExpr(rhs[0], [], undefined);
};
this.reduceActions[30] = function(rhs) {
if (Utilities.instance_of(rhs[0], PathExpr)) {
if (rhs[0].filterPredicates == undefined) {
rhs[0].filterPredicates = [];
}
rhs[0].filterPredicates.push(rhs[1]);
return rhs[0];
} else {
return new PathExpr(rhs[0], [rhs[1]], undefined);
}
};
this.reduceActions[32] = function(rhs) {
return rhs[1];
};
this.reduceActions[33] = function(rhs) {
return new XString(rhs[0]);
};
this.reduceActions[34] = function(rhs) {
return new XNumber(rhs[0]);
};
this.reduceActions[36] = function(rhs) {
return new FunctionCall(rhs[0], []);
};
this.reduceActions[37] = function(rhs) {
return new FunctionCall(rhs[0], rhs[2]);
};
this.reduceActions[38] = function(rhs) {
return [ rhs[0] ];
};
this.reduceActions[39] = function(rhs) {
rhs[2].unshift(rhs[0]);
return rhs[2];
};
this.reduceActions[43] = function(rhs) {
return new LocationPath(true, []);
};
this.reduceActions[44] = function(rhs) {
rhs[1].absolute = true;
return rhs[1];
};
this.reduceActions[46] = function(rhs) {
return new LocationPath(false, [ rhs[0] ]);
};
this.reduceActions[47] = function(rhs) {
rhs[0].steps.push(rhs[2]);
return rhs[0];
};
this.reduceActions[49] = function(rhs) {
return new Step(rhs[0], rhs[1], []);
};
this.reduceActions[50] = function(rhs) {
return new Step(Step.CHILD, rhs[0], []);
};
this.reduceActions[51] = function(rhs) {
return new Step(rhs[0], rhs[1], rhs[2]);
};
this.reduceActions[52] = function(rhs) {
return new Step(Step.CHILD, rhs[0], rhs[1]);
};
this.reduceActions[54] = function(rhs) {
return [ rhs[0] ];
};
this.reduceActions[55] = function(rhs) {
rhs[1].unshift(rhs[0]);
return rhs[1];
};
this.reduceActions[56] = function(rhs) {
if (rhs[0] == "ancestor") {
return Step.ANCESTOR;
} else if (rhs[0] == "ancestor-or-self") {
return Step.ANCESTORORSELF;
} else if (rhs[0] == "attribute") {
return Step.ATTRIBUTE;
} else if (rhs[0] == "child") {
return Step.CHILD;
} else if (rhs[0] == "descendant") {
return Step.DESCENDANT;
} else if (rhs[0] == "descendant-or-self") {
return Step.DESCENDANTORSELF;
} else if (rhs[0] == "following") {
return Step.FOLLOWING;
} else if (rhs[0] == "following-sibling") {
return Step.FOLLOWINGSIBLING;
} else if (rhs[0] == "namespace") {
return Step.NAMESPACE;
} else if (rhs[0] == "parent") {
return Step.PARENT;
} else if (rhs[0] == "preceding") {
return Step.PRECEDING;
} else if (rhs[0] == "preceding-sibling") {
return Step.PRECEDINGSIBLING;
} else if (rhs[0] == "self") {
return Step.SELF;
}
return -1;
};
this.reduceActions[57] = function(rhs) {
return Step.ATTRIBUTE;
};
this.reduceActions[59] = function(rhs) {
if (rhs[0] == "comment") {
return new NodeTest(NodeTest.COMMENT, undefined);
} else if (rhs[0] == "text") {
return new NodeTest(NodeTest.TEXT, undefined);
} else if (rhs[0] == "processing-instruction") {
return new NodeTest(NodeTest.PI, undefined);
} else if (rhs[0] == "node") {
return new NodeTest(NodeTest.NODE, undefined);
}
return new NodeTest(-1, undefined);
};
this.reduceActions[60] = function(rhs) {
return new NodeTest(NodeTest.PI, rhs[2]);
};
this.reduceActions[61] = function(rhs) {
return rhs[1];
};
this.reduceActions[63] = function(rhs) {
rhs[1].absolute = true;
rhs[1].steps.unshift(new Step(Step.DESCENDANTORSELF, new NodeTest(NodeTest.NODE, undefined), []));
return rhs[1];
};
this.reduceActions[64] = function(rhs) {
rhs[0].steps.push(new Step(Step.DESCENDANTORSELF, new NodeTest(NodeTest.NODE, undefined), []));
rhs[0].steps.push(rhs[2]);
return rhs[0];
};
this.reduceActions[65] = function(rhs) {
return new Step(Step.SELF, new NodeTest(NodeTest.NODE, undefined), []);
};
this.reduceActions[66] = function(rhs) {
return new Step(Step.PARENT, new NodeTest(NodeTest.NODE, undefined), []);
};
this.reduceActions[67] = function(rhs) {
return new VariableReference(rhs[1]);
};
this.reduceActions[68] = function(rhs) {
return new NodeTest(NodeTest.NAMETESTANY, undefined);
};
this.reduceActions[69] = function(rhs) {
var prefix = rhs[0].substring(0, rhs[0].indexOf(":"));
return new NodeTest(NodeTest.NAMETESTPREFIXANY, prefix);
};
this.reduceActions[70] = function(rhs) {
return new NodeTest(NodeTest.NAMETESTQNAME, rhs[0]);
};
};
XPathParser.actionTable = [
" s s        sssssssss    s ss  s  ss",
"                 s                  ",
"r  rrrrrrrrr         rrrrrrr rr  r  ",
"                rrrrr               ",
" s s        sssssssss    s ss  s  ss",
"rs  rrrrrrrr s  sssssrrrrrr  rrs rs ",
" s s        sssssssss    s ss  s  ss",
"                            s       ",
"                            s       ",
"r  rrrrrrrrr         rrrrrrr rr rr  ",
"r  rrrrrrrrr         rrrrrrr rr rr  ",
"r  rrrrrrrrr         rrrrrrr rr rr  ",
"r  rrrrrrrrr         rrrrrrr rr rr  ",
"r  rrrrrrrrr         rrrrrrr rr rr  ",
"  s                                 ",
"                            s       ",
" s           s  sssss          s  s ",
"r  rrrrrrrrr         rrrrrrr rr  r  ",
"a                                   ",
"r       s                    rr  r  ",
"r      sr                    rr  r  ",
"r   s  rr            s       rr  r  ",
"r   rssrr            rss     rr  r  ",
"r   rrrrr            rrrss   rr  r  ",
"r   rrrrrsss         rrrrr   rr  r  ",
"r   rrrrrrrr         rrrrr   rr  r  ",
"r   rrrrrrrr         rrrrrs  rr  r  ",
"r   rrrrrrrr         rrrrrr  rr  r  ",
"r   rrrrrrrr         rrrrrr  rr  r  ",
"r  srrrrrrrr         rrrrrrs rr sr  ",
"r  srrrrrrrr         rrrrrrs rr  r  ",
"r  rrrrrrrrr         rrrrrrr rr rr  ",
"r  rrrrrrrrr         rrrrrrr rr rr  ",
"r  rrrrrrrrr         rrrrrrr rr rr  ",
"r   rrrrrrrr         rrrrrr  rr  r  ",
"r   rrrrrrrr         rrrrrr  rr  r  ",
"r  rrrrrrrrr         rrrrrrr rr  r  ",
"r  rrrrrrrrr         rrrrrrr rr  r  ",
"                sssss               ",
"r  rrrrrrrrr         rrrrrrr rr sr  ",
"r  rrrrrrrrr         rrrrrrr rr  r  ",
"r  rrrrrrrrr         rrrrrrr rr rr  ",
"r  rrrrrrrrr         rrrrrrr rr rr  ",
"                             s      ",
"r  srrrrrrrr         rrrrrrs rr  r  ",
"r   rrrrrrrr         rrrrr   rr  r  ",
"              s                     ",
"                             s      ",
"                rrrrr               ",
" s s        sssssssss    s sss s  ss",
"r  srrrrrrrr         rrrrrrs rr  r  ",
" s s        sssssssss    s ss  s  ss",
" s s        sssssssss    s ss  s  ss",
" s s        sssssssss    s ss  s  ss",
" s s        sssssssss    s ss  s  ss",
" s s        sssssssss    s ss  s  ss",
" s s        sssssssss    s ss  s  ss",
" s s        sssssssss    s ss  s  ss",
" s s        sssssssss    s ss  s  ss",
" s s        sssssssss    s ss  s  ss",
" s s        sssssssss    s ss  s  ss",
" s s        sssssssss    s ss  s  ss",
" s s        sssssssss    s ss  s  ss",
" s s        sssssssss    s ss  s  ss",
" s s        sssssssss      ss  s  ss",
" s s        sssssssss    s ss  s  ss",
" s           s  sssss          s  s ",
" s           s  sssss          s  s ",
"r  rrrrrrrrr         rrrrrrr rr rr  ",
" s           s  sssss          s  s ",
" s           s  sssss          s  s ",
"r  rrrrrrrrr         rrrrrrr rr sr  ",
"r  rrrrrrrrr         rrrrrrr rr sr  ",
"r  rrrrrrrrr         rrrrrrr rr  r  ",
"r  rrrrrrrrr         rrrrrrr rr rr  ",
"                             s      ",
"r  rrrrrrrrr         rrrrrrr rr rr  ",
"r  rrrrrrrrr         rrrrrrr rr rr  ",
"                             rr     ",
"                             s      ",
"                             rs     ",
"r      sr                    rr  r  ",
"r   s  rr            s       rr  r  ",
"r   rssrr            rss     rr  r  ",
"r   rssrr            rss     rr  r  ",
"r   rrrrr            rrrss   rr  r  ",
"r   rrrrr            rrrss   rr  r  ",
"r   rrrrr            rrrss   rr  r  ",
"r   rrrrr            rrrss   rr  r  ",
"r   rrrrrsss         rrrrr   rr  r  ",
"r   rrrrrsss         rrrrr   rr  r  ",
"r   rrrrrrrr         rrrrr   rr  r  ",
"r   rrrrrrrr         rrrrr   rr  r  ",
"r   rrrrrrrr         rrrrr   rr  r  ",
"r   rrrrrrrr         rrrrrr  rr  r  ",
"                                 r  ",
"                                 s  ",
"r  srrrrrrrr         rrrrrrs rr  r  ",
"r  srrrrrrrr         rrrrrrs rr  r  ",
"r  rrrrrrrrr         rrrrrrr rr  r  ",
"r  rrrrrrrrr         rrrrrrr rr  r  ",
"r  rrrrrrrrr         rrrrrrr rr  r  ",
"r  rrrrrrrrr         rrrrrrr rr  r  ",
"r  rrrrrrrrr         rrrrrrr rr rr  ",
"r  rrrrrrrrr         rrrrrrr rr rr  ",
" s s        sssssssss    s ss  s  ss",
"r  rrrrrrrrr         rrrrrrr rr rr  ",
"                             r      "
];
XPathParser.actionTableNumber = [
" 1 0        /.-,+*)('    & %$  #  \"!",
"                 J                  ",
"a  aaaaaaaaa         aaaaaaa aa  a  ",
"                YYYYY               ",
" 1 0        /.-,+*)('    & %$  #  \"!",
"K1  KKKKKKKK .  +*)('KKKKKK  KK# K\" ",
" 1 0        /.-,+*)('    & %$  #  \"!",
"                            N       ",
"                            O       ",
"e  eeeeeeeee         eeeeeee ee ee  ",
"f  fffffffff         fffffff ff ff  ",
"d  ddddddddd         ddddddd dd dd  ",
"B  BBBBBBBBB         BBBBBBB BB BB  ",
"A  AAAAAAAAA         AAAAAAA AA AA  ",
"  P                                 ",
"                            Q       ",
" 1           .  +*)('          #  \" ",
"b  bbbbbbbbb         bbbbbbb bb  b  ",
"                                    ",
"!       S                    !!  !  ",
"\"      T\"                    \"\"  \"  ",
"$   V  $$            U       $$  $  ",
"&   &ZY&&            &XW     &&  &  ",
")   )))))            )))\\[   ))  )  ",
".   ....._^]         .....   ..  .  ",
"1   11111111         11111   11  1  ",
"5   55555555         55555`  55  5  ",
"7   77777777         777777  77  7  ",
"9   99999999         999999  99  9  ",
":  c::::::::         ::::::b :: a:  ",
"I  fIIIIIIII         IIIIIIe II  I  ",
"=  =========         ======= == ==  ",
"?  ?????????         ??????? ?? ??  ",
"C  CCCCCCCCC         CCCCCCC CC CC  ",
"J   JJJJJJJJ         JJJJJJ  JJ  J  ",
"M   MMMMMMMM         MMMMMM  MM  M  ",
"N  NNNNNNNNN         NNNNNNN NN  N  ",
"P  PPPPPPPPP         PPPPPPP PP  P  ",
"                +*)('               ",
"R  RRRRRRRRR         RRRRRRR RR aR  ",
"U  UUUUUUUUU         UUUUUUU UU  U  ",
"Z  ZZZZZZZZZ         ZZZZZZZ ZZ ZZ  ",
"c  ccccccccc         ccccccc cc cc  ",
"                             j      ",
"L  fLLLLLLLL         LLLLLLe LL  L  ",
"6   66666666         66666   66  6  ",
"              k                     ",
"                             l      ",
"                XXXXX               ",
" 1 0        /.-,+*)('    & %$m #  \"!",
"_  f________         ______e __  _  ",
" 1 0        /.-,+*)('    & %$  #  \"!",
" 1 0        /.-,+*)('    & %$  #  \"!",
" 1 0        /.-,+*)('    & %$  #  \"!",
" 1 0        /.-,+*)('    & %$  #  \"!",
" 1 0        /.-,+*)('    & %$  #  \"!",
" 1 0        /.-,+*)('    & %$  #  \"!",
" 1 0        /.-,+*)('    & %$  #  \"!",
" 1 0        /.-,+*)('    & %$  #  \"!",
" 1 0        /.-,+*)('    & %$  #  \"!",
" 1 0        /.-,+*)('    & %$  #  \"!",
" 1 0        /.-,+*)('    & %$  #  \"!",
" 1 0        /.-,+*)('    & %$  #  \"!",
" 1 0        /.-,+*)('    & %$  #  \"!",
" 1 0        /.-,+*)('      %$  #  \"!",
" 1 0        /.-,+*)('    & %$  #  \"!",
" 1           .  +*)('          #  \" ",
" 1           .  +*)('          #  \" ",
">  >>>>>>>>>         >>>>>>> >> >>  ",
" 1           .  +*)('          #  \" ",
" 1           .  +*)('          #  \" ",
"Q  QQQQQQQQQ         QQQQQQQ QQ aQ  ",
"V  VVVVVVVVV         VVVVVVV VV aV  ",
"T  TTTTTTTTT         TTTTTTT TT  T  ",
"@  @@@@@@@@@         @@@@@@@ @@ @@  ",
"                             \x87      ",
"[  [[[[[[[[[         [[[[[[[ [[ [[  ",
"D  DDDDDDDDD         DDDDDDD DD DD  ",
"                             HH     ",
"                             \x88      ",
"                             F\x89     ",
"#      T#                    ##  #  ",
"%   V  %%            U       %%  %  ",
"'   'ZY''            'XW     ''  '  ",
"(   (ZY((            (XW     ((  (  ",
"+   +++++            +++\\[   ++  +  ",
"*   *****            ***\\[   **  *  ",
"-   -----            ---\\[   --  -  ",
",   ,,,,,            ,,,\\[   ,,  ,  ",
"0   00000_^]         00000   00  0  ",
"/   /////_^]         /////   //  /  ",
"2   22222222         22222   22  2  ",
"3   33333333         33333   33  3  ",
"4   44444444         44444   44  4  ",
"8   88888888         888888  88  8  ",
"                                 ^  ",
"                                 \x8a  ",
";  f;;;;;;;;         ;;;;;;e ;;  ;  ",
"<  f<<<<<<<<         <<<<<<e <<  <  ",
"O  OOOOOOOOO         OOOOOOO OO  O  ",
"`  `````````         ``````` ``  `  ",
"S  SSSSSSSSS         SSSSSSS SS  S  ",
"W  WWWWWWWWW         WWWWWWW WW  W  ",
"\\  \\\\\\\\\\\\\\\\\\         \\\\\\\\\\\\\\ \\\\ \\\\  ",
"E  EEEEEEEEE         EEEEEEE EE EE  ",
" 1 0        /.-,+*)('    & %$  #  \"!",
"]  ]]]]]]]]]         ]]]]]]] ]] ]]  ",
"                             G      "
];
XPathParser.gotoTable = [
"3456789:;<=>?@ AB  CDEFGH IJ ",
"                             ",
"                             ",
"                             ",
"L456789:;<=>?@ AB  CDEFGH IJ ",
"            M        EFGH IJ ",
"       N;<=>?@ AB  CDEFGH IJ ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"            S        EFGH IJ ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"              e              ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                        h  J ",
"              i          j   ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"o456789:;<=>?@ ABpqCDEFGH IJ ",
"                             ",
"  r6789:;<=>?@ AB  CDEFGH IJ ",
"   s789:;<=>?@ AB  CDEFGH IJ ",
"    t89:;<=>?@ AB  CDEFGH IJ ",
"    u89:;<=>?@ AB  CDEFGH IJ ",
"     v9:;<=>?@ AB  CDEFGH IJ ",
"     w9:;<=>?@ AB  CDEFGH IJ ",
"     x9:;<=>?@ AB  CDEFGH IJ ",
"     y9:;<=>?@ AB  CDEFGH IJ ",
"      z:;<=>?@ AB  CDEFGH IJ ",
"      {:;<=>?@ AB  CDEFGH IJ ",
"       |;<=>?@ AB  CDEFGH IJ ",
"       };<=>?@ AB  CDEFGH IJ ",
"       ~;<=>?@ AB  CDEFGH IJ ",
"         \x7f=>?@ AB  CDEFGH IJ ",
"\x80456789:;<=>?@ AB  CDEFGH IJ\x81",
"            \x82        EFGH IJ ",
"            \x83        EFGH IJ ",
"                             ",
"                     \x84 GH IJ ",
"                     \x85 GH IJ ",
"              i          \x86   ",
"              i          \x87   ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"                             ",
"o456789:;<=>?@ AB\x8cqCDEFGH IJ ",
"                             ",
"                             "
];
XPathParser.productions = [
[1, 1, 2],
[2, 1, 3],
[3, 1, 4],
[3, 3, 3, -9, 4],
[4, 1, 5],
[4, 3, 4, -8, 5],
[5, 1, 6],
[5, 3, 5, -22, 6],
[5, 3, 5, -5, 6],
[6, 1, 7],
[6, 3, 6, -23, 7],
[6, 3, 6, -24, 7],
[6, 3, 6, -6, 7],
[6, 3, 6, -7, 7],
[7, 1, 8],
[7, 3, 7, -25, 8],
[7, 3, 7, -26, 8],
[8, 1, 9],
[8, 3, 8, -12, 9],
[8, 3, 8, -11, 9],
[8, 3, 8, -10, 9],
[9, 1, 10],
[9, 2, -26, 9],
[10, 1, 11],
[10, 3, 10, -27, 11],
[11, 1, 12],
[11, 1, 13],
[11, 3, 13, -28, 14],
[11, 3, 13, -4, 14],
[13, 1, 15],
[13, 2, 13, 16],
[15, 1, 17],
[15, 3, -29, 2, -30],
[15, 1, -15],
[15, 1, -16],
[15, 1, 18],
[18, 3, -13, -29, -30],
[18, 4, -13, -29, 19, -30],
[19, 1, 20],
[19, 3, 20, -31, 19],
[20, 1, 2],
[12, 1, 14],
[12, 1, 21],
[21, 1, -28],
[21, 2, -28, 14],
[21, 1, 22],
[14, 1, 23],
[14, 3, 14, -28, 23],
[14, 1, 24],
[23, 2, 25, 26],
[23, 1, 26],
[23, 3, 25, 26, 27],
[23, 2, 26, 27],
[23, 1, 28],
[27, 1, 16],
[27, 2, 16, 27],
[25, 2, -14, -3],
[25, 1, -32],
[26, 1, 29],
[26, 3, -20, -29, -30],
[26, 4, -21, -29, -15, -30],
[16, 3, -33, 30, -34],
[30, 1, 2],
[22, 2, -4, 14],
[24, 3, 14, -4, 23],
[28, 1, -35],
[28, 1, -2],
[17, 2, -36, -18],
[29, 1, -17],
[29, 1, -19],
[29, 1, -18]
];
XPathParser.DOUBLEDOT = 2;
XPathParser.DOUBLECOLON = 3;
XPathParser.DOUBLESLASH = 4;
XPathParser.NOTEQUAL = 5;
XPathParser.LESSTHANOREQUAL = 6;
XPathParser.GREATERTHANOREQUAL = 7;
XPathParser.AND = 8;
XPathParser.OR = 9;
XPathParser.MOD = 10;
XPathParser.DIV = 11;
XPathParser.MULTIPLYOPERATOR = 12;
XPathParser.FUNCTIONNAME = 13;
XPathParser.AXISNAME = 14;
XPathParser.LITERAL = 15;
XPathParser.NUMBER = 16;
XPathParser.ASTERISKNAMETEST = 17;
XPathParser.QNAME = 18;
XPathParser.NCNAMECOLONASTERISK = 19;
XPathParser.NODETYPE = 20;
XPathParser.PROCESSINGINSTRUCTIONWITHLITERAL = 21;
XPathParser.EQUALS = 22;
XPathParser.LESSTHAN = 23;
XPathParser.GREATERTHAN = 24;
XPathParser.PLUS = 25;
XPathParser.MINUS = 26;
XPathParser.BAR = 27;
XPathParser.SLASH = 28;
XPathParser.LEFTPARENTHESIS = 29;
XPathParser.RIGHTPARENTHESIS = 30;
XPathParser.COMMA = 31;
XPathParser.AT = 32;
XPathParser.LEFTBRACKET = 33;
XPathParser.RIGHTBRACKET = 34;
XPathParser.DOT = 35;
XPathParser.DOLLAR = 36;
XPathParser.prototype.tokenize = function(s1) {
var types = [];
var values = [];
var s = s1 + '\0';
var pos = 0;
var c = s.charAt(pos++);
while (1) {
while (c == ' ' || c == '\t' || c == '\r' || c == '\n') {
c = s.charAt(pos++);
}
if (c == '\0' || pos >= s.length) {
break;
}
if (c == '(') {
types.push(XPathParser.LEFTPARENTHESIS);
values.push(c);
c = s.charAt(pos++);
continue;
}
if (c == ')') {
types.push(XPathParser.RIGHTPARENTHESIS);
values.push(c);
c = s.charAt(pos++);
continue;
}
if (c == '[') {
types.push(XPathParser.LEFTBRACKET);
values.push(c);
c = s.charAt(pos++);
continue;
}
if (c == ']') {
types.push(XPathParser.RIGHTBRACKET);
values.push(c);
c = s.charAt(pos++);
continue;
}
if (c == '@') {
types.push(XPathParser.AT);
values.push(c);
c = s.charAt(pos++);
continue;
}
if (c == ',') {
types.push(XPathParser.COMMA);
values.push(c);
c = s.charAt(pos++);
continue;
}
if (c == '|') {
types.push(XPathParser.BAR);
values.push(c);
c = s.charAt(pos++);
continue;
}
if (c == '+') {
types.push(XPathParser.PLUS);
values.push(c);
c = s.charAt(pos++);
continue;
}
if (c == '-') {
types.push(XPathParser.MINUS);
values.push(c);
c = s.charAt(pos++);
continue;
}
if (c == '=') {
types.push(XPathParser.EQUALS);
values.push(c);
c = s.charAt(pos++);
continue;
}
if (c == '$') {
types.push(XPathParser.DOLLAR);
values.push(c);
c = s.charAt(pos++);
continue;
}
if (c == '.') {
c = s.charAt(pos++);
if (c == '.') {
types.push(XPathParser.DOUBLEDOT);
values.push("..");
c = s.charAt(pos++);
continue;
}
if (c >= '0' && c <= '9') {
var number = "." + c;
c = s.charAt(pos++);
while (c >= '0' && c <= '9') {
number += c;
c = s.charAt(pos++);
}
types.push(XPathParser.NUMBER);
values.push(number);
continue;
}
types.push(XPathParser.DOT);
values.push('.');
continue;
}
if (c == '\'' || c == '"') {
var delimiter = c;
var literal = "";
while ((c = s.charAt(pos++)) != delimiter) {
literal += c;
}
types.push(XPathParser.LITERAL);
values.push(literal);
c = s.charAt(pos++);
continue;
}
if (c >= '0' && c <= '9') {
var number = c;
c = s.charAt(pos++);
while (c >= '0' && c <= '9') {
number += c;
c = s.charAt(pos++);
}
if (c == '.') {
if (s.charAt(pos) >= '0' && s.charAt(pos) <= '9') {
number += c;
number += s.charAt(pos++);
c = s.charAt(pos++);
while (c >= '0' && c <= '9') {
number += c;
c = s.charAt(pos++);
}
}
}
types.push(XPathParser.NUMBER);
values.push(number);
continue;
}
if (c == '*') {
if (types.length > 0) {
var last = types[types.length - 1];
if (last != XPathParser.AT
&& last != XPathParser.DOUBLECOLON
&& last != XPathParser.LEFTPARENTHESIS
&& last != XPathParser.LEFTBRACKET
&& last != XPathParser.AND
&& last != XPathParser.OR
&& last != XPathParser.MOD
&& last != XPathParser.DIV
&& last != XPathParser.MULTIPLYOPERATOR
&& last != XPathParser.SLASH
&& last != XPathParser.DOUBLESLASH
&& last != XPathParser.BAR
&& last != XPathParser.PLUS
&& last != XPathParser.MINUS
&& last != XPathParser.EQUALS
&& last != XPathParser.NOTEQUAL
&& last != XPathParser.LESSTHAN
&& last != XPathParser.LESSTHANOREQUAL
&& last != XPathParser.GREATERTHAN
&& last != XPathParser.GREATERTHANOREQUAL) {
types.push(XPathParser.MULTIPLYOPERATOR);
values.push(c);
c = s.charAt(pos++);
continue;
}
}
types.push(XPathParser.ASTERISKNAMETEST);
values.push(c);
c = s.charAt(pos++);
continue;
}
if (c == ':') {
if (s.charAt(pos) == ':') {
types.push(XPathParser.DOUBLECOLON);
values.push("::");
pos++;
c = s.charAt(pos++);
continue;
}
}
if (c == '/') {
c = s.charAt(pos++);
if (c == '/') {
types.push(XPathParser.DOUBLESLASH);
values.push("//");
c = s.charAt(pos++);
continue;
}
types.push(XPathParser.SLASH);
values.push('/');
continue;
}
if (c == '!') {
if (s.charAt(pos) == '=') {
types.push(XPathParser.NOTEQUAL);
values.push("!=");
pos++;
c = s.charAt(pos++);
continue;
}
}
if (c == '<') {
if (s.charAt(pos) == '=') {
types.push(XPathParser.LESSTHANOREQUAL);
values.push("<=");
pos++;
c = s.charAt(pos++);
continue;
}
types.push(XPathParser.LESSTHAN);
values.push('<');
c = s.charAt(pos++);
continue;
}
if (c == '>') {
if (s.charAt(pos) == '=') {
types.push(XPathParser.GREATERTHANOREQUAL);
values.push(">=");
pos++;
c = s.charAt(pos++);
continue;
}
types.push(XPathParser.GREATERTHAN);
values.push('>');
c = s.charAt(pos++);
continue;
}
if (c == '_' || Utilities.isLetter(c.charCodeAt(0))) {
var name = c;
c = s.charAt(pos++);
while (Utilities.isNCNameChar(c.charCodeAt(0))) {
name += c;
c = s.charAt(pos++);
}
if (types.length > 0) {
var last = types[types.length - 1];
if (last != XPathParser.AT
&& last != XPathParser.DOUBLECOLON
&& last != XPathParser.LEFTPARENTHESIS
&& last != XPathParser.LEFTBRACKET
&& last != XPathParser.AND
&& last != XPathParser.OR
&& last != XPathParser.MOD
&& last != XPathParser.DIV
&& last != XPathParser.MULTIPLYOPERATOR
&& last != XPathParser.SLASH
&& last != XPathParser.DOUBLESLASH
&& last != XPathParser.BAR
&& last != XPathParser.PLUS
&& last != XPathParser.MINUS
&& last != XPathParser.EQUALS
&& last != XPathParser.NOTEQUAL
&& last != XPathParser.LESSTHAN
&& last != XPathParser.LESSTHANOREQUAL
&& last != XPathParser.GREATERTHAN
&& last != XPathParser.GREATERTHANOREQUAL) {
if (name == "and") {
types.push(XPathParser.AND);
values.push(name);
continue;
}
if (name == "or") {
types.push(XPathParser.OR);
values.push(name);
continue;
}
if (name == "mod") {
types.push(XPathParser.MOD);
values.push(name);
continue;
}
if (name == "div") {
types.push(XPathParser.DIV);
values.push(name);
continue;
}
}
}
if (c == ':') {
if (s.charAt(pos) == '*') {
types.push(XPathParser.NCNAMECOLONASTERISK);
values.push(name + ":*");
pos++;
c = s.charAt(pos++);
continue;
}
if (s.charAt(pos) == '_' || Utilities.isLetter(s.charCodeAt(pos))) {
name += ':';
c = s.charAt(pos++);
while (Utilities.isNCNameChar(c.charCodeAt(0))) {
name += c;
c = s.charAt(pos++);
}
if (c == '(') {
types.push(XPathParser.FUNCTIONNAME);
values.push(name);
continue;
}
types.push(XPathParser.QNAME);
values.push(name);
continue;
}
if (s.charAt(pos) == ':') {
types.push(XPathParser.AXISNAME);
values.push(name);
continue;
}
}
if (c == '(') {
if (name == "comment" || name == "text" || name == "node") {
types.push(XPathParser.NODETYPE);
values.push(name);
continue;
}
if (name == "processing-instruction") {
if (s.charAt(pos) == ')') {
types.push(XPathParser.NODETYPE);
} else {
types.push(XPathParser.PROCESSINGINSTRUCTIONWITHLITERAL);
}
values.push(name);
continue;
}
types.push(XPathParser.FUNCTIONNAME);
values.push(name);
continue;
}
types.push(XPathParser.QNAME);
values.push(name);
continue;
}
throw new Error("Unexpected character " + c);
}
types.push(1);
values.push("[EOF]");
return [types, values];
};
XPathParser.SHIFT = 's';
XPathParser.REDUCE = 'r';
XPathParser.ACCEPT = 'a';
XPathParser.prototype.parse = function(s) {
var types;
var values;
var res = this.tokenize(s);
if (res == undefined) {
return undefined;
}
types = res[0];
values = res[1];
var tokenPos = 0;
var state = [];
var tokenType = [];
var tokenValue = [];
var s;
var a;
var t;
state.push(0);
tokenType.push(1);
tokenValue.push("_S");
a = types[tokenPos];
t = values[tokenPos++];
while (1) {
s = state[state.length - 1];
switch (XPathParser.actionTable[s].charAt(a - 1)) {
case XPathParser.SHIFT:
tokenType.push(-a);
tokenValue.push(t);
state.push(XPathParser.actionTableNumber[s].charCodeAt(a - 1) - 32);
a = types[tokenPos];
t = values[tokenPos++];
break;
case XPathParser.REDUCE:
var num = XPathParser.productions[XPathParser.actionTableNumber[s].charCodeAt(a - 1) - 32][1];
var rhs = [];
for (var i = 0; i < num; i++) {
tokenType.pop();
rhs.unshift(tokenValue.pop());
state.pop();
}
var s_ = state[state.length - 1];
tokenType.push(XPathParser.productions[XPathParser.actionTableNumber[s].charCodeAt(a - 1) - 32][0]);
if (this.reduceActions[XPathParser.actionTableNumber[s].charCodeAt(a - 1) - 32] == undefined) {
tokenValue.push(rhs[0]);
} else {
tokenValue.push(this.reduceActions[XPathParser.actionTableNumber[s].charCodeAt(a - 1) - 32](rhs));
}
state.push(XPathParser.gotoTable[s_].charCodeAt(XPathParser.productions[XPathParser.actionTableNumber[s].charCodeAt(a - 1) - 32][0] - 2) - 33);
break;
case XPathParser.ACCEPT:
return new XPath(tokenValue.pop());
default:
throw new Error("XPath parse error");
}
}
};

XPath.prototype = new Object();
XPath.prototype.constructor = XPath;
XPath.superclass = Object.prototype;
function XPath(e) {
this.expression = e;
}
XPath.prototype.toString = function() {
return this.expression.toString();
};
XPath.prototype.evaluate = function(c) {
c.contextNode = c.expressionContextNode;
c.contextSize = 1;
c.contextPosition = 1;
c.caseInsensitive = false;
if (c.contextNode != null) {
var doc = c.contextNode;
if (doc.nodeType != 9 ) {
doc = doc.ownerDocument;
}
try {
c.caseInsensitive = doc.implementation.hasFeature("HTML", "2.0");
} catch (e) {
c.caseInsensitive = true;
}
}
return this.expression.evaluate(c);
};
XPath.XML_NAMESPACE_URI = "http://www.w3.org/XML/1998/namespace";
XPath.XMLNS_NAMESPACE_URI = "http://www.w3.org/2000/xmlns/";

Expression.prototype = new Object();
Expression.prototype.constructor = Expression;
Expression.superclass = Object.prototype;
function Expression() {
}
Expression.prototype.init = function() {
};
Expression.prototype.toString = function() {
return "<Expression>";
};
Expression.prototype.evaluate = function(c) {
throw new Error("Could not evaluate expression.");
};

UnaryOperation.prototype = new Expression();
UnaryOperation.prototype.constructor = UnaryOperation;
UnaryOperation.superclass = Expression.prototype;
function UnaryOperation(rhs) {
if (arguments.length > 0) {
this.init(rhs);
}
}
UnaryOperation.prototype.init = function(rhs) {
this.rhs = rhs;
};

UnaryMinusOperation.prototype = new UnaryOperation();
UnaryMinusOperation.prototype.constructor = UnaryMinusOperation;
UnaryMinusOperation.superclass = UnaryOperation.prototype;
function UnaryMinusOperation(rhs) {
if (arguments.length > 0) {
this.init(rhs);
}
}
UnaryMinusOperation.prototype.init = function(rhs) {
UnaryMinusOperation.superclass.init.call(this, rhs);
};
UnaryMinusOperation.prototype.evaluate = function(c) {
return this.rhs.evaluate(c).number().negate();
};
UnaryMinusOperation.prototype.toString = function() {
return "-" + this.rhs.toString();
};

BinaryOperation.prototype = new Expression();
BinaryOperation.prototype.constructor = BinaryOperation;
BinaryOperation.superclass = Expression.prototype;
function BinaryOperation(lhs, rhs) {
if (arguments.length > 0) {
this.init(lhs, rhs);
}
}
BinaryOperation.prototype.init = function(lhs, rhs) {
this.lhs = lhs;
this.rhs = rhs;
};

OrOperation.prototype = new BinaryOperation();
OrOperation.prototype.constructor = OrOperation;
OrOperation.superclass = BinaryOperation.prototype;
function OrOperation(lhs, rhs) {
if (arguments.length > 0) {
this.init(lhs, rhs);
}
}
OrOperation.prototype.init = function(lhs, rhs) {
OrOperation.superclass.init.call(this, lhs, rhs);
};
OrOperation.prototype.toString = function() {
return "(" + this.lhs.toString() + " or " + this.rhs.toString() + ")";
};
OrOperation.prototype.evaluate = function(c) {
var b = this.lhs.evaluate(c).bool();
if (b.booleanValue()) {
return b;
}
return this.rhs.evaluate(c).bool();
};

AndOperation.prototype = new BinaryOperation();
AndOperation.prototype.constructor = AndOperation;
AndOperation.superclass = BinaryOperation.prototype;
function AndOperation(lhs, rhs) {
if (arguments.length > 0) {
this.init(lhs, rhs);
}
}
AndOperation.prototype.init = function(lhs, rhs) {
AndOperation.superclass.init.call(this, lhs, rhs);
};
AndOperation.prototype.toString = function() {
return "(" + this.lhs.toString() + " and " + this.rhs.toString() + ")";
};
AndOperation.prototype.evaluate = function(c) {
var b = this.lhs.evaluate(c).bool();
if (!b.booleanValue()) {
return b;
}
return this.rhs.evaluate(c).bool();
};

EqualsOperation.prototype = new BinaryOperation();
EqualsOperation.prototype.constructor = EqualsOperation;
EqualsOperation.superclass = BinaryOperation.prototype;
function EqualsOperation(lhs, rhs) {
if (arguments.length > 0) {
this.init(lhs, rhs);
}
}
EqualsOperation.prototype.init = function(lhs, rhs) {
EqualsOperation.superclass.init.call(this, lhs, rhs);
};
EqualsOperation.prototype.toString = function() {
return "(" + this.lhs.toString() + " = " + this.rhs.toString() + ")";
};
EqualsOperation.prototype.evaluate = function(c) {
return this.lhs.evaluate(c).equals(this.rhs.evaluate(c));
};

NotEqualOperation.prototype = new BinaryOperation();
NotEqualOperation.prototype.constructor = NotEqualOperation;
NotEqualOperation.superclass = BinaryOperation.prototype;
function NotEqualOperation(lhs, rhs) {
if (arguments.length > 0) {
this.init(lhs, rhs);
}
}
NotEqualOperation.prototype.init = function(lhs, rhs) {
NotEqualOperation.superclass.init.call(this, lhs, rhs);
};
NotEqualOperation.prototype.toString = function() {
return "(" + this.lhs.toString() + " != " + this.rhs.toString() + ")";
};
NotEqualOperation.prototype.evaluate = function(c) {
return this.lhs.evaluate(c).notequal(this.rhs.evaluate(c));
};

LessThanOperation.prototype = new BinaryOperation();
LessThanOperation.prototype.constructor = LessThanOperation;
LessThanOperation.superclass = BinaryOperation.prototype;
function LessThanOperation(lhs, rhs) {
if (arguments.length > 0) {
this.init(lhs, rhs);
}
}
LessThanOperation.prototype.init = function(lhs, rhs) {
LessThanOperation.superclass.init.call(this, lhs, rhs);
};
LessThanOperation.prototype.evaluate = function(c) {
return this.lhs.evaluate(c).lessthan(this.rhs.evaluate(c));
};
LessThanOperation.prototype.toString = function() {
return "(" + this.lhs.toString() + " < " + this.rhs.toString() + ")";
};

GreaterThanOperation.prototype = new BinaryOperation();
GreaterThanOperation.prototype.constructor = GreaterThanOperation;
GreaterThanOperation.superclass = BinaryOperation.prototype;
function GreaterThanOperation(lhs, rhs) {
if (arguments.length > 0) {
this.init(lhs, rhs);
}
}
GreaterThanOperation.prototype.init = function(lhs, rhs) {
GreaterThanOperation.superclass.init.call(this, lhs, rhs);
};
GreaterThanOperation.prototype.evaluate = function(c) {
return this.lhs.evaluate(c).greaterthan(this.rhs.evaluate(c));
};
GreaterThanOperation.prototype.toString = function() {
return "(" + this.lhs.toString() + " > " + this.rhs.toString() + ")";
};

LessThanOrEqualOperation.prototype = new BinaryOperation();
LessThanOrEqualOperation.prototype.constructor = LessThanOrEqualOperation;
LessThanOrEqualOperation.superclass = BinaryOperation.prototype;
function LessThanOrEqualOperation(lhs, rhs) {
if (arguments.length > 0) {
this.init(lhs, rhs);
}
}
LessThanOrEqualOperation.prototype.init = function(lhs, rhs) {
LessThanOrEqualOperation.superclass.init.call(this, lhs, rhs);
};
LessThanOrEqualOperation.prototype.evaluate = function(c) {
return this.lhs.evaluate(c).lessthanorequal(this.rhs.evaluate(c));
};
LessThanOrEqualOperation.prototype.toString = function() {
return "(" + this.lhs.toString() + " <= " + this.rhs.toString() + ")";
};

GreaterThanOrEqualOperation.prototype = new BinaryOperation();
GreaterThanOrEqualOperation.prototype.constructor = GreaterThanOrEqualOperation;
GreaterThanOrEqualOperation.superclass = BinaryOperation.prototype;
function GreaterThanOrEqualOperation(lhs, rhs) {
if (arguments.length > 0) {
this.init(lhs, rhs);
}
}
GreaterThanOrEqualOperation.prototype.init = function(lhs, rhs) {
GreaterThanOrEqualOperation.superclass.init.call(this, lhs, rhs);
};
GreaterThanOrEqualOperation.prototype.evaluate = function(c) {
return this.lhs.evaluate(c).greaterthanorequal(this.rhs.evaluate(c));
};
GreaterThanOrEqualOperation.prototype.toString = function() {
return "(" + this.lhs.toString() + " >= " + this.rhs.toString() + ")";
};

PlusOperation.prototype = new BinaryOperation();
PlusOperation.prototype.constructor = PlusOperation;
PlusOperation.superclass = BinaryOperation.prototype;
function PlusOperation(lhs, rhs) {
if (arguments.length > 0) {
this.init(lhs, rhs);
}
}
PlusOperation.prototype.init = function(lhs, rhs) {
PlusOperation.superclass.init.call(this, lhs, rhs);
};
PlusOperation.prototype.evaluate = function(c) {
return this.lhs.evaluate(c).number().plus(this.rhs.evaluate(c).number());
};
PlusOperation.prototype.toString = function() {
return "(" + this.lhs.toString() + " + " + this.rhs.toString() + ")";
};

MinusOperation.prototype = new BinaryOperation();
MinusOperation.prototype.constructor = MinusOperation;
MinusOperation.superclass = BinaryOperation.prototype;
function MinusOperation(lhs, rhs) {
if (arguments.length > 0) {
this.init(lhs, rhs);
}
}
MinusOperation.prototype.init = function(lhs, rhs) {
MinusOperation.superclass.init.call(this, lhs, rhs);
};
MinusOperation.prototype.evaluate = function(c) {
return this.lhs.evaluate(c).number().minus(this.rhs.evaluate(c).number());
};
MinusOperation.prototype.toString = function() {
return "(" + this.lhs.toString() + " - " + this.rhs.toString() + ")";
};

MultiplyOperation.prototype = new BinaryOperation();
MultiplyOperation.prototype.constructor = MultiplyOperation;
MultiplyOperation.superclass = BinaryOperation.prototype;
function MultiplyOperation(lhs, rhs) {
if (arguments.length > 0) {
this.init(lhs, rhs);
}
}
MultiplyOperation.prototype.init = function(lhs, rhs) {
MultiplyOperation.superclass.init.call(this, lhs, rhs);
};
MultiplyOperation.prototype.evaluate = function(c) {
return this.lhs.evaluate(c).number().multiply(this.rhs.evaluate(c).number());
};
MultiplyOperation.prototype.toString = function() {
return "(" + this.lhs.toString() + " * " + this.rhs.toString() + ")";
};

DivOperation.prototype = new BinaryOperation();
DivOperation.prototype.constructor = DivOperation;
DivOperation.superclass = BinaryOperation.prototype;
function DivOperation(lhs, rhs) {
if (arguments.length > 0) {
this.init(lhs, rhs);
}
}
DivOperation.prototype.init = function(lhs, rhs) {
DivOperation.superclass.init.call(this, lhs, rhs);
};
DivOperation.prototype.evaluate = function(c) {
return this.lhs.evaluate(c).number().div(this.rhs.evaluate(c).number());
};
DivOperation.prototype.toString = function() {
return "(" + this.lhs.toString() + " div " + this.rhs.toString() + ")";
};

ModOperation.prototype = new BinaryOperation();
ModOperation.prototype.constructor = ModOperation;
ModOperation.superclass = BinaryOperation.prototype;
function ModOperation(lhs, rhs) {
if (arguments.length > 0) {
this.init(lhs, rhs);
}
}
ModOperation.prototype.init = function(lhs, rhs) {
ModOperation.superclass.init.call(this, lhs, rhs);
};
ModOperation.prototype.evaluate = function(c) {
return this.lhs.evaluate(c).number().mod(this.rhs.evaluate(c).number());
};
ModOperation.prototype.toString = function() {
return "(" + this.lhs.toString() + " mod " + this.rhs.toString() + ")";
};

BarOperation.prototype = new BinaryOperation();
BarOperation.prototype.constructor = BarOperation;
BarOperation.superclass = BinaryOperation.prototype;
function BarOperation(lhs, rhs) {
if (arguments.length > 0) {
this.init(lhs, rhs);
}
}
BarOperation.prototype.init = function(lhs, rhs) {
BarOperation.superclass.init.call(this, lhs, rhs);
};
BarOperation.prototype.evaluate = function(c) {
return this.lhs.evaluate(c).nodeset().union(this.rhs.evaluate(c).nodeset());
};
BarOperation.prototype.toString = function() {
return this.lhs.toString() + " | " + this.rhs.toString();
};

PathExpr.prototype = new Expression();
PathExpr.prototype.constructor = PathExpr;
PathExpr.superclass = Expression.prototype;
function PathExpr(filter, filterPreds, locpath) {
if (arguments.length > 0) {
this.init(filter, filterPreds, locpath);
}
}
PathExpr.prototype.init = function(filter, filterPreds, locpath) {
PathExpr.superclass.init.call(this);
this.filter = filter;
this.filterPredicates = filterPreds;
this.locationPath = locpath;
};
PathExpr.prototype.evaluate = function(c) {
var nodes;
var xpc = new XPathContext();
xpc.variableResolver = c.variableResolver;
xpc.functionResolver = c.functionResolver;
xpc.namespaceResolver = c.namespaceResolver;
xpc.expressionContextNode = c.expressionContextNode;
xpc.virtualRoot = c.virtualRoot;
xpc.caseInsensitive = c.caseInsensitive;
if (this.filter == null) {
nodes = [ c.contextNode ];
} else {
var ns = this.filter.evaluate(c);
if (!Utilities.instance_of(ns, XNodeSet)) {
if (this.filterPredicates != null && this.filterPredicates.length > 0 || this.locationPath != null) {
throw new Error("Path expression filter must evaluate to a nodset if predicates or location path are used");
}
return ns;
}
nodes = ns.toArray();
if (this.filterPredicates != null) {

for (var j = 0; j < this.filterPredicates.length; j++) {
var pred = this.filterPredicates[j];
var newNodes = [];
xpc.contextSize = nodes.length;
for (xpc.contextPosition = 1; xpc.contextPosition <= xpc.contextSize; xpc.contextPosition++) {
xpc.contextNode = nodes[xpc.contextPosition - 1];
if (this.predicateMatches(pred, xpc)) {
newNodes.push(xpc.contextNode);
}
}
nodes = newNodes;
}
}
}
if (this.locationPath != null) {
if (this.locationPath.absolute) {
if (nodes[0].nodeType != 9 ) {
if (xpc.virtualRoot != null) {
nodes = [ xpc.virtualRoot ];
} else {
if (nodes[0].ownerDocument == null) {

var n = nodes[0];
while (n.parentNode != null) {
n = n.parentNode;
}
nodes = [ n ];
} else {
nodes = [ nodes[0].ownerDocument ];
}
}
} else {
nodes = [ nodes[0] ];
}
}
for (var i = 0; i < this.locationPath.steps.length; i++) {
var step = this.locationPath.steps[i];
var newNodes = [];
for (var j = 0; j < nodes.length; j++) {
xpc.contextNode = nodes[j];
switch (step.axis) {
case Step.ANCESTOR:

if (xpc.contextNode === xpc.virtualRoot) {
break;
}
var m;
if (xpc.contextNode.nodeType == 2 ) {
m = this.getOwnerElement(xpc.contextNode);
} else {
m = xpc.contextNode.parentNode;
}
while (m != null) {
if (step.nodeTest.matches(m, xpc)) {
newNodes.push(m);
}
if (m === xpc.virtualRoot) {
break;
}
m = m.parentNode;
}
break;
case Step.ANCESTORORSELF:

for (var m = xpc.contextNode; m != null; m = m.nodeType == 2  ? this.getOwnerElement(m) : m.parentNode) {
if (step.nodeTest.matches(m, xpc)) {
newNodes.push(m);
}
if (m === xpc.virtualRoot) {
break;
}
}
break;
case Step.ATTRIBUTE:

var nnm = xpc.contextNode.attributes;
if (nnm != null) {
for (var k = 0; k < nnm.length; k++) {
var m = nnm.item(k);
if (step.nodeTest.matches(m, xpc)) {
newNodes.push(m);
}
}
}
break;
case Step.CHILD:

for (var m = xpc.contextNode.firstChild; m != null; m = m.nextSibling) {
if (step.nodeTest.matches(m, xpc)) {
newNodes.push(m);
}
}
break;
case Step.DESCENDANT:

var st = [ xpc.contextNode.firstChild ];
while (st.length > 0) {
for (var m = st.pop(); m != null; ) {
if (step.nodeTest.matches(m, xpc)) {
newNodes.push(m);
}
if (m.firstChild != null) {
st.push(m.nextSibling);
m = m.firstChild;
} else {
m = m.nextSibling;
}
}
}
break;
case Step.DESCENDANTORSELF:

if (step.nodeTest.matches(xpc.contextNode, xpc)) {
newNodes.push(xpc.contextNode);
}

var st = [ xpc.contextNode.firstChild ];
while (st.length > 0) {
for (var m = st.pop(); m != null; ) {
if (step.nodeTest.matches(m, xpc)) {
newNodes.push(m);
}
if (m.firstChild != null) {
st.push(m.nextSibling);
m = m.firstChild;
} else {
m = m.nextSibling;
}
}
}
break;
case Step.FOLLOWING:
if (xpc.contextNode === xpc.virtualRoot) {
break;
}
var st = [];
if (xpc.contextNode.firstChild != null) {
st.unshift(xpc.contextNode.firstChild);
} else {
st.unshift(xpc.contextNode.nextSibling);
}
for (var m = xpc.contextNode.parentNode; m != null && m.nodeType != 9  && m !== xpc.virtualRoot; m = m.parentNode) {
st.unshift(m.nextSibling);
}
do {
for (var m = st.pop(); m != null; ) {
if (step.nodeTest.matches(m, xpc)) {
newNodes.push(m);
}
if (m.firstChild != null) {
st.push(m.nextSibling);
m = m.firstChild;
} else {
m = m.nextSibling;
}
}
} while (st.length > 0);
break;
case Step.FOLLOWINGSIBLING:
if (xpc.contextNode === xpc.virtualRoot) {
break;
}
for (var m = xpc.contextNode.nextSibling; m != null; m = m.nextSibling) {
if (step.nodeTest.matches(m, xpc)) {
newNodes.push(m);
}
}
break;
case Step.NAMESPACE:
var n = {};
if (xpc.contextNode.nodeType == 1 ) {
n["xml"] = XPath.XML_NAMESPACE_URI;
n["xmlns"] = XPath.XMLNS_NAMESPACE_URI;
for (var m = xpc.contextNode; m != null && m.nodeType == 1 ; m = m.parentNode) {
for (var k = 0; k < m.attributes.length; k++) {
var attr = m.attributes.item(k);
var nm = String(attr.name);
if (nm == "xmlns") {
if (n[""] == undefined) {
n[""] = attr.value;
}
} else if (nm.length > 6 && nm.substring(0, 6) == "xmlns:") {
var pre = nm.substring(6, nm.length);
if (n[pre] == undefined) {
n[pre] = attr.value;
}
}
}
}
for (var pre in n) {
var nsn = new NamespaceNode(pre, n[pre], xpc.contextNode);
if (step.nodeTest.matches(nsn, xpc)) {
newNodes.push(nsn);
}
}
}
break;
case Step.PARENT:
m = null;
if (xpc.contextNode !== xpc.virtualRoot) {
if (xpc.contextNode.nodeType == 2 ) {
m = this.getOwnerElement(xpc.contextNode);
} else {
m = xpc.contextNode.parentNode;
}
}
if (m != null && step.nodeTest.matches(m, xpc)) {
newNodes.push(m);
}
break;
case Step.PRECEDING:
var st;
if (xpc.virtualRoot != null) {
st = [ xpc.virtualRoot ];
} else {
st = xpc.contextNode.nodeType == 9 
? [ xpc.contextNode ]
: [ xpc.contextNode.ownerDocument ];
}
outer: while (st.length > 0) {
for (var m = st.pop(); m != null; ) {
if (m == xpc.contextNode) {
break outer;
}
if (step.nodeTest.matches(m, xpc)) {
newNodes.unshift(m);
}
if (m.firstChild != null) {
st.push(m.nextSibling);
m = m.firstChild;
} else {
m = m.nextSibling;
}
}
}
break;
case Step.PRECEDINGSIBLING:
if (xpc.contextNode === xpc.virtualRoot) {
break;
}
for (var m = xpc.contextNode.previousSibling; m != null; m = m.previousSibling) {
if (step.nodeTest.matches(m, xpc)) {
newNodes.push(m);
}
}
break;
case Step.SELF:
if (step.nodeTest.matches(xpc.contextNode, xpc)) {
newNodes.push(xpc.contextNode);
}
break;
default:
}
}
nodes = newNodes;

for (var j = 0; j < step.predicates.length; j++) {
var pred = step.predicates[j];
var newNodes = [];
xpc.contextSize = nodes.length;
for (xpc.contextPosition = 1; xpc.contextPosition <= xpc.contextSize; xpc.contextPosition++) {
xpc.contextNode = nodes[xpc.contextPosition - 1];
if (this.predicateMatches(pred, xpc)) {
newNodes.push(xpc.contextNode);
} else {
}
}
nodes = newNodes;
}
}
}
var ns = new XNodeSet();
ns.addArray(nodes);
return ns;
};
PathExpr.prototype.predicateMatches = function(pred, c) {
var res = pred.evaluate(c);
if (Utilities.instance_of(res, XNumber)) {
return c.contextPosition == res.numberValue();
}
return res.booleanValue();
};
PathExpr.prototype.toString = function() {
if (this.filter != undefined) {
var s = this.filter.toString();
if (Utilities.instance_of(this.filter, XString)) {
s = "'" + s + "'";
}
if (this.filterPredicates != undefined) {
for (var i = 0; i < this.filterPredicates.length; i++) {
s = s + "[" + this.filterPredicates[i].toString() + "]";
}
}
if (this.locationPath != undefined) {
if (!this.locationPath.absolute) {
s += "/";
}
s += this.locationPath.toString();
}
return s;
}
return this.locationPath.toString();
};
PathExpr.prototype.getOwnerElement = function(n) {

if (n.ownerElement) {
return n.ownerElement;
}

try {
if (n.selectSingleNode) {
return n.selectSingleNode("..");
}
} catch (e) {
}

var doc = n.nodeType == 9 
? n
: n.ownerDocument;
var elts = doc.getElementsByTagName("*");
for (var i = 0; i < elts.length; i++) {
var elt = elts.item(i);
var nnm = elt.attributes;
for (var j = 0; j < nnm.length; j++) {
var an = nnm.item(j);
if (an === n) {
return elt;
}
}
}
return null;
};

LocationPath.prototype = new Object();
LocationPath.prototype.constructor = LocationPath;
LocationPath.superclass = Object.prototype;
function LocationPath(abs, steps) {
if (arguments.length > 0) {
this.init(abs, steps);
}
}
LocationPath.prototype.init = function(abs, steps) {
this.absolute = abs;
this.steps = steps;
};
LocationPath.prototype.toString = function() {
var s;
if (this.absolute) {
s = "/";
} else {
s = "";
}
for (var i = 0; i < this.steps.length; i++) {
if (i != 0) {
s += "/";
}
s += this.steps[i].toString();
}
return s;
};

Step.prototype = new Object();
Step.prototype.constructor = Step;
Step.superclass = Object.prototype;
function Step(axis, nodetest, preds) {
if (arguments.length > 0) {
this.init(axis, nodetest, preds);
}
}
Step.prototype.init = function(axis, nodetest, preds) {
this.axis = axis;
this.nodeTest = nodetest;
this.predicates = preds;
};
Step.prototype.toString = function() {
var s;
switch (this.axis) {
case Step.ANCESTOR:
s = "ancestor";
break;
case Step.ANCESTORORSELF:
s = "ancestor-or-self";
break;
case Step.ATTRIBUTE:
s = "attribute";
break;
case Step.CHILD:
s = "child";
break;
case Step.DESCENDANT:
s = "descendant";
break;
case Step.DESCENDANTORSELF:
s = "descendant-or-self";
break;
case Step.FOLLOWING:
s = "following";
break;
case Step.FOLLOWINGSIBLING:
s = "following-sibling";
break;
case Step.NAMESPACE:
s = "namespace";
break;
case Step.PARENT:
s = "parent";
break;
case Step.PRECEDING:
s = "preceding";
break;
case Step.PRECEDINGSIBLING:
s = "preceding-sibling";
break;
case Step.SELF:
s = "self";
break;
}
s += "::";
s += this.nodeTest.toString();
for (var i = 0; i < this.predicates.length; i++) {
s += "[" + this.predicates[i].toString() + "]";
}
return s;
};
Step.ANCESTOR = 0;
Step.ANCESTORORSELF = 1;
Step.ATTRIBUTE = 2;
Step.CHILD = 3;
Step.DESCENDANT = 4;
Step.DESCENDANTORSELF = 5;
Step.FOLLOWING = 6;
Step.FOLLOWINGSIBLING = 7;
Step.NAMESPACE = 8;
Step.PARENT = 9;
Step.PRECEDING = 10;
Step.PRECEDINGSIBLING = 11;
Step.SELF = 12;

NodeTest.prototype = new Object();
NodeTest.prototype.constructor = NodeTest;
NodeTest.superclass = Object.prototype;
function NodeTest(type, value) {
if (arguments.length > 0) {
this.init(type, value);
}
}
NodeTest.prototype.init = function(type, value) {
this.type = type;
this.value = value;
};
NodeTest.prototype.toString = function() {
switch (this.type) {
case NodeTest.NAMETESTANY:
return "*";
case NodeTest.NAMETESTPREFIXANY:
return this.value + ":*";
case NodeTest.NAMETESTRESOLVEDANY:
return "{" + this.value + "}*";
case NodeTest.NAMETESTQNAME:
return this.value;
case NodeTest.NAMETESTRESOLVEDNAME:
return "{" + this.namespaceURI + "}" + this.value;
case NodeTest.COMMENT:
return "comment()";
case NodeTest.TEXT:
return "text()";
case NodeTest.PI:
if (this.value != undefined) {
return "processing-instruction(\"" + this.value + "\")";
}
return "processing-instruction()";
case NodeTest.NODE:
return "node()";
}
return "<unknown nodetest type>";
};
NodeTest.prototype.matches = function(n, xpc) {
switch (this.type) {
case NodeTest.NAMETESTANY:
if (n.nodeType == 2 
|| n.nodeType == 1 
|| n.nodeType == XPathNamespace.XPATH_NAMESPACE_NODE) {
return true;
}
return false;
case NodeTest.NAMETESTPREFIXANY:
if ((n.nodeType == 2  || n.nodeType == 1 )) {
var ns = xpc.namespaceResolver.getNamespace(this.value, xpc.expressionContextNode);
if (ns == null) {
throw new Error("Cannot resolve QName " + this.value);
}
return true;	
}
return false;
case NodeTest.NAMETESTQNAME:
if (n.nodeType == 2 
|| n.nodeType == 1 
|| n.nodeType == XPathNamespace.XPATH_NAMESPACE_NODE) {
var test = Utilities.resolveQName(this.value, xpc.namespaceResolver, xpc.expressionContextNode, false);
if (test[0] == null) {
throw new Error("Cannot resolve QName " + this.value);
}
test[0] = String(test[0]);
test[1] = String(test[1]);
if (test[0] == "") {
test[0] = null;
}
var node = Utilities.resolveQName(n.nodeName, xpc.namespaceResolver, n, n.nodeType == 1 );
node[0] = String(node[0]);
node[1] = String(node[1]);
if (node[0] == "") {
node[0] = null;
}
if (xpc.caseInsensitive) {
return test[0] == node[0] && String(test[1]).toLowerCase() == String(node[1]).toLowerCase();
}
return test[0] == node[0] && test[1] == node[1];
}
return false;
case NodeTest.COMMENT:
return n.nodeType == 8 ;
case NodeTest.TEXT:
return n.nodeType == 3  || n.nodeType == 4 ;
case NodeTest.PI:
return n.nodeType == 7 
&& (this.value == null || n.nodeName == this.value);
case NodeTest.NODE:
return n.nodeType == 9 
|| n.nodeType == 1 
|| n.nodeType == 2 
|| n.nodeType == 3 
|| n.nodeType == 4 
|| n.nodeType == 8 
|| n.nodeType == 7 ;
}
return false;
};
NodeTest.NAMETESTANY = 0;
NodeTest.NAMETESTPREFIXANY = 1;
NodeTest.NAMETESTQNAME = 2;
NodeTest.COMMENT = 3;
NodeTest.TEXT = 4;
NodeTest.PI = 5;
NodeTest.NODE = 6;

VariableReference.prototype = new Expression();
VariableReference.prototype.constructor = VariableReference;
VariableReference.superclass = Expression.prototype;
function VariableReference(v) {
if (arguments.length > 0) {
this.init(v);
}
}
VariableReference.prototype.init = function(v) {
this.variable = v;
};
VariableReference.prototype.toString = function() {
return "$" + this.variable;
};
VariableReference.prototype.evaluate = function(c) {
return c.variableResolver.getVariable(this.variable, c);
};

FunctionCall.prototype = new Expression();
FunctionCall.prototype.constructor = FunctionCall;
FunctionCall.superclass = Expression.prototype;
function FunctionCall(fn, args) {
if (arguments.length > 0) {
this.init(fn, args);
}
}
FunctionCall.prototype.init = function(fn, args) {
this.functionName = fn;
this.arguments = args;
};
FunctionCall.prototype.toString = function() {
var s = this.functionName + "(";
for (var i = 0; i < this.arguments.length; i++) {
if (i > 0) {
s += ", ";
}
s += this.arguments[i].toString();
}
return s + ")";
};
FunctionCall.prototype.evaluate = function(c) {
var f = c.functionResolver.getFunction(this.functionName, c);
if (f == undefined) {
throw new Error("Unknown function " + this.functionName);
}
var a = [c].concat(this.arguments);
return f.apply(c.functionResolver.thisArg, a);
};

XString.prototype = new Expression();
XString.prototype.constructor = XString;
XString.superclass = Expression.prototype;
function XString(s) {
if (arguments.length > 0) {
this.init(s);
}
}
XString.prototype.init = function(s) {
this.str = s;
};
XString.prototype.toString = function() {
return this.str;
};
XString.prototype.evaluate = function(c) {
return this;
};
XString.prototype.string = function() {
return this;
};
XString.prototype.number = function() {
return new XNumber(this.str);
};
XString.prototype.bool = function() {
return new XBoolean(this.str);
};
XString.prototype.nodeset = function() {
throw new Error("Cannot convert string to nodeset");
};
XString.prototype.stringValue = function() {
return this.str;
};
XString.prototype.numberValue = function() {
return this.number().numberValue();
};
XString.prototype.booleanValue = function() {
return this.bool().booleanValue();
};
XString.prototype.equals = function(r) {
if (Utilities.instance_of(r, XBoolean)) {
return this.bool().equals(r);
}
if (Utilities.instance_of(r, XNumber)) {
return this.number().equals(r);
}
if (Utilities.instance_of(r, XNodeSet)) {
return r.compareWithString(this, Operators.equals);
}
return new XBoolean(this.str == r.str);
};
XString.prototype.notequal = function(r) {
if (Utilities.instance_of(r, XBoolean)) {
return this.bool().notequal(r);
}
if (Utilities.instance_of(r, XNumber)) {
return this.number().notequal(r);
}
if (Utilities.instance_of(r, XNodeSet)) {
return r.compareWithString(this, Operators.notequal);
}
return new XBoolean(this.str != r.str);
};
XString.prototype.lessthan = function(r) {
if (Utilities.instance_of(r, XNodeSet)) {
return r.compareWithNumber(this.number(), Operators.greaterthanorequal);
}
return this.number().lessthan(r.number());
};
XString.prototype.greaterthan = function(r) {
if (Utilities.instance_of(r, XNodeSet)) {
return r.compareWithNumber(this.number(), Operators.lessthanorequal);
}
return this.number().greaterthan(r.number());
};
XString.prototype.lessthanorequal = function(r) {
if (Utilities.instance_of(r, XNodeSet)) {
return r.compareWithNumber(this.number(), Operators.greaterthan);
}
return this.number().lessthanorequal(r.number());
};
XString.prototype.greaterthanorequal = function(r) {
if (Utilities.instance_of(r, XNodeSet)) {
return r.compareWithNumber(this.number(), Operators.lessthan);
}
return this.number().greaterthanorequal(r.number());
};

XNumber.prototype = new Expression();
XNumber.prototype.constructor = XNumber;
XNumber.superclass = Expression.prototype;
function XNumber(n) {
if (arguments.length > 0) {
this.init(n);
}
}
XNumber.prototype.init = function(n) {
this.num = Number(n);
};
XNumber.prototype.toString = function() {
return this.num;
};
XNumber.prototype.evaluate = function(c) {
return this;
};
XNumber.prototype.string = function() {
return new XString(this.num);
};
XNumber.prototype.number = function() {
return this;
};
XNumber.prototype.bool = function() {
return new XBoolean(this.num);
};
XNumber.prototype.nodeset = function() {
throw new Error("Cannot convert number to nodeset");
};
XNumber.prototype.stringValue = function() {
return this.string().stringValue();
};
XNumber.prototype.numberValue = function() {
return this.num;
};
XNumber.prototype.booleanValue = function() {
return this.bool().booleanValue();
};
XNumber.prototype.negate = function() {
return new XNumber(-this.num);
};
XNumber.prototype.equals = function(r) {
if (Utilities.instance_of(r, XBoolean)) {
return this.bool().equals(r);
}
if (Utilities.instance_of(r, XString)) {
return this.equals(r.number());
}
if (Utilities.instance_of(r, XNodeSet)) {
return r.compareWithNumber(this, Operators.equals);
}
return new XBoolean(this.num == r.num);
};
XNumber.prototype.notequal = function(r) {
if (Utilities.instance_of(r, XBoolean)) {
return this.bool().notequal(r);
}
if (Utilities.instance_of(r, XString)) {
return this.notequal(r.number());
}
if (Utilities.instance_of(r, XNodeSet)) {
return r.compareWithNumber(this, Operators.notequal);
}
return new XBoolean(this.num != r.num);
};
XNumber.prototype.lessthan = function(r) {
if (Utilities.instance_of(r, XNodeSet)) {
return r.compareWithNumber(this, Operators.greaterthanorequal);
}
if (Utilities.instance_of(r, XBoolean) || Utilities.instance_of(r, XString)) {
return this.lessthan(r.number());
}
return new XBoolean(this.num < r.num);
};
XNumber.prototype.greaterthan = function(r) {
if (Utilities.instance_of(r, XNodeSet)) {
return r.compareWithNumber(this, Operators.lessthanorequal);
}
if (Utilities.instance_of(r, XBoolean) || Utilities.instance_of(r, XString)) {
return this.greaterthan(r.number());
}
return new XBoolean(this.num > r.num);
};
XNumber.prototype.lessthanorequal = function(r) {
if (Utilities.instance_of(r, XNodeSet)) {
return r.compareWithNumber(this, Operators.greaterthan);
}
if (Utilities.instance_of(r, XBoolean) || Utilities.instance_of(r, XString)) {
return this.lessthanorequal(r.number());
}
return new XBoolean(this.num <= r.num);
};
XNumber.prototype.greaterthanorequal = function(r) {
if (Utilities.instance_of(r, XNodeSet)) {
return r.compareWithNumber(this, Operators.lessthan);
}
if (Utilities.instance_of(r, XBoolean) || Utilities.instance_of(r, XString)) {
return this.greaterthanorequal(r.number());
}
return new XBoolean(this.num >= r.num);
};
XNumber.prototype.plus = function(r) {
return new XNumber(this.num + r.num);
};
XNumber.prototype.minus = function(r) {
return new XNumber(this.num - r.num);
};
XNumber.prototype.multiply = function(r) {
return new XNumber(this.num * r.num);
};
XNumber.prototype.div = function(r) {
return new XNumber(this.num / r.num);
};
XNumber.prototype.mod = function(r) {
return new XNumber(this.num % r.num);
};

XBoolean.prototype = new Expression();
XBoolean.prototype.constructor = XBoolean;
XBoolean.superclass = Expression.prototype;
function XBoolean(b) {
if (arguments.length > 0) {
this.init(b);
}
}
XBoolean.prototype.init = function(b) {
this.b = Boolean(b);
};
XBoolean.prototype.toString = function() {
return this.b.toString();
};
XBoolean.prototype.evaluate = function(c) {
return this;
};
XBoolean.prototype.string = function() {
return new XString(this.b);
};
XBoolean.prototype.number = function() {
return new XNumber(this.b);
};
XBoolean.prototype.bool = function() {
return this;
};
XBoolean.prototype.nodeset = function() {
throw new Error("Cannot convert boolean to nodeset");
};
XBoolean.prototype.stringValue = function() {
return this.string().stringValue();
};
XBoolean.prototype.numberValue = function() {
return this.num().numberValue();
};
XBoolean.prototype.booleanValue = function() {
return this.b;
};
XBoolean.prototype.not = function() {
return new XBoolean(!this.b);
};
XBoolean.prototype.equals = function(r) {
if (Utilities.instance_of(r, XString) || Utilities.instance_of(r, XNumber)) {
return this.equals(r.bool());
}
if (Utilities.instance_of(r, XNodeSet)) {
return r.compareWithBoolean(this, Operators.equals);
}
return new XBoolean(this.b == r.b);
};
XBoolean.prototype.notequal = function(r) {
if (Utilities.instance_of(r, XString) || Utilities.instance_of(r, XNumber)) {
return this.notequal(r.bool());
}
if (Utilities.instance_of(r, XNodeSet)) {
return r.compareWithBoolean(this, Operators.notequal);
}
return new XBoolean(this.b != r.b);
};
XBoolean.prototype.lessthan = function(r) {
if (Utilities.instance_of(r, XNodeSet)) {
return r.compareWithNumber(this.number(), Operators.greaterthanorequal);
}
return this.number().lessthan(r.number());
};
XBoolean.prototype.greaterthan = function(r) {
if (Utilities.instance_of(r, XNodeSet)) {
return r.compareWithNumber(this.number(), Operators.lessthanorequal);
}
return this.number().greaterthan(r.number());
};
XBoolean.prototype.lessthanorequal = function(r) {
if (Utilities.instance_of(r, XNodeSet)) {
return r.compareWithNumber(this.number(), Operators.greaterthan);
}
return this.number().lessthanorequal(r.number());
};
XBoolean.prototype.greaterthanorequal = function(r) {
if (Utilities.instance_of(r, XNodeSet)) {
return r.compareWithNumber(this.number(), Operators.lessthan);
}
return this.number().greaterthanorequal(r.number());
};

AVLTree.prototype = new Object();
AVLTree.prototype.constructor = AVLTree;
AVLTree.superclass = Object.prototype;
function AVLTree(n) {
this.init(n);
}
AVLTree.prototype.init = function(n) {
this.left = null;
this.right = null;
this.node = n;
this.depth = 1;
};
AVLTree.prototype.balance = function() {
var ldepth = this.left == null ? 0 : this.left.depth;
var rdepth = this.right == null ? 0 : this.right.depth;
if (ldepth > rdepth + 1) {

var lldepth = this.left.left == null ? 0 : this.left.left.depth;
var lrdepth = this.left.right == null ? 0 : this.left.right.depth;
if (lldepth < lrdepth) {

this.left.rotateRR();

}
this.rotateLL(); 
} else if (ldepth + 1 < rdepth) {

var rrdepth = this.right.right == null ? 0 : this.right.right.depth;
var rldepth = this.right.left == null ? 0 : this.right.left.depth;
if (rldepth > rrdepth) {

this.right.rotateLL();

}
this.rotateRR();
} 
};
AVLTree.prototype.rotateLL = function() {

var nodeBefore = this.node;
var rightBefore = this.right;
this.node = this.left.node;
this.right = this.left;
this.left = this.left.left;
this.right.left = this.right.right;
this.right.right = rightBefore;
this.right.node = nodeBefore;
this.right.updateInNewLocation();
this.updateInNewLocation();
};
AVLTree.prototype.rotateRR = function() {

var nodeBefore = this.node;
var leftBefore = this.left;
this.node = this.right.node;
this.left = this.right;
this.right = this.right.right;
this.left.right = this.left.left;
this.left.left = leftBefore;
this.left.node = nodeBefore;
this.left.updateInNewLocation();
this.updateInNewLocation();
}; 
AVLTree.prototype.updateInNewLocation = function() {
this.getDepthFromChildren();
};
AVLTree.prototype.getDepthFromChildren = function() {
this.depth = this.node == null ? 0 : 1;
if (this.left != null) {
this.depth = this.left.depth + 1;
}
if (this.right != null && this.depth <= this.right.depth) {
this.depth = this.right.depth + 1;
}
};
AVLTree.prototype.order = function(n1, n2) {
if (n1 === n2) {
return 0;
}
var d1 = 0;
var d2 = 0;
for (var m1 = n1; m1 != null; m1 = m1.parentNode) {
d1++;
}
for (var m2 = n2; m2 != null; m2 = m2.parentNode) {
d2++;
}
if (d1 > d2) {
while (d1 > d2) {
n1 = n1.parentNode;
d1--;
}
if (n1 == n2) {
return 1;
}
} else if (d2 > d1) {
while (d2 > d1) {
n2 = n2.parentNode;
d2--;
}
if (n1 == n2) {
return -1;
}
}
while (n1.parentNode != n2.parentNode) {
n1 = n1.parentNode;
n2 = n2.parentNode;
}
while (n1.previousSibling != null && n2.previousSibling != null) {
n1 = n1.previousSibling;
n2 = n2.previousSibling;
}
if (n1.previousSibling == null) {
return -1;
}
return 1;
};
AVLTree.prototype.add = function(n) {
if (n === this.node) {
return false;
}
var o = this.order(n, this.node);
var ret = false;
if (o == -1) {
if (this.left == null) {
this.left = new AVLTree(n);
ret = true;
} else {
ret = this.left.add(n);
if (ret) {
this.balance();
}
}
} else if (o == 1) {
if (this.right == null) {
this.right = new AVLTree(n);
ret = true;
} else {
ret = this.right.add(n);
if (ret) {
this.balance();
}
}
}
if (ret) {
this.getDepthFromChildren();
}
return ret;
};

XNodeSet.prototype = new Expression();
XNodeSet.prototype.constructor = XNodeSet;
XNodeSet.superclass = Expression.prototype;
function XNodeSet() {
this.init();
}
XNodeSet.prototype.init = function() {
this.tree = null;
this.size = 0;
};
XNodeSet.prototype.toString = function() {
var p = this.first();
if (p == null) {
return "";
}
return this.stringForNode(p);
};
XNodeSet.prototype.evaluate = function(c) {
return this;
};
XNodeSet.prototype.string = function() {
return new XString(this.toString());
};
XNodeSet.prototype.stringValue = function() {
return this.toString();
};
XNodeSet.prototype.number = function() {
return new XNumber(this.string());
};
XNodeSet.prototype.numberValue = function() {
return Number(this.string());
};
XNodeSet.prototype.bool = function() {
return new XBoolean(this.tree != null);
};
XNodeSet.prototype.booleanValue = function() {
return this.tree != null;
};
XNodeSet.prototype.nodeset = function() {
return this;
};
XNodeSet.prototype.stringForNode = function(n) {
if (n.nodeType == 9 ) {
n = n.documentElement;
}
if (n.nodeType == 1 ) {
return this.stringForNodeRec(n);
}
if (n.isNamespaceNode) {
return n.namespace;
}
return n.nodeValue;
};
XNodeSet.prototype.stringForNodeRec = function(n) {
var s = "";
for (var n2 = n.firstChild; n2 != null; n2 = n2.nextSibling) {
if (n2.nodeType == 3 ) {
s += n2.nodeValue;
} else if (n2.nodeType == 1 ) {
s += this.stringForNodeRec(n2);
}
}
return s;
};
XNodeSet.prototype.first = function() {
var p = this.tree;
if (p == null) {
return null;
}
while (p.left != null) {
p = p.left;
}
return p.node;
};
XNodeSet.prototype.add = function(n) {
var added;
if (this.tree == null) {
this.tree = new AVLTree(n);
added = true;
} else {
added = this.tree.add(n);
}
if (added) {
this.size++;
}
};
XNodeSet.prototype.addArray = function(ns) {
for (var i = 0; i < ns.length; i++) {
this.add(ns[i]);
}
};
XNodeSet.prototype.toArray = function() {
var a = [];
this.toArrayRec(this.tree, a);
return a;
};
XNodeSet.prototype.toArrayRec = function(t, a) {
if (t != null) {
this.toArrayRec(t.left, a);
a.push(t.node);
this.toArrayRec(t.right, a);
}
};
XNodeSet.prototype.compareWithString = function(r, o) {
var a = this.toArray();
for (var i = 0; i < a.length; i++) {
var n = a[i];
var l = new XString(this.stringForNode(n));
var res = o(l, r);
if (res.booleanValue()) {
return res;
}
}
return new XBoolean(false);
};
XNodeSet.prototype.compareWithNumber = function(r, o) {
var a = this.toArray();
for (var i = 0; i < a.length; i++) {
var n = a[i];
var l = new XNumber(this.stringForNode(n));
var res = o(l, r);
if (res.booleanValue()) {
return res;
}
}
return new XBoolean(false);
};
XNodeSet.prototype.compareWithBoolean = function(r, o) {
return o(this.bool(), r);
};
XNodeSet.prototype.compareWithNodeSet = function(r, o) {
var a = this.toArray();
for (var i = 0; i < a.length; i++) {
var n = a[i];
var l = new XString(this.stringForNode(n));
var b = r.toArray();
for (var j = 0; j < b.length; j++) {
var n2 = b[j];
var r = new XString(this.stringForNode(n2));
var res = o(l, r);
if (res.booleanValue()) {
return res;
}
}
}
return new XBoolean(false);
};
XNodeSet.prototype.equals = function(r) {
if (Utilities.instance_of(r, XString)) {
return this.compareWithString(r, Operators.equals);
}
if (Utilities.instance_of(r, XNumber)) {
return this.compareWithNumber(r, Operators.equals);
}
if (Utilities.instance_of(r, XBoolean)) {
return this.compareWithBoolean(r, Operators.equals);
}
return this.compareWithNodeSet(r, Operators.equals);
};
XNodeSet.prototype.notequal = function(r) {
if (Utilities.instance_of(r, XString)) {
return this.compareWithString(r, Operators.notequal);
}
if (Utilities.instance_of(r, XNumber)) {
return this.compareWithNumber(r, Operators.notequal);
}
if (Utilities.instance_of(r, XBoolean)) {
return this.compareWithBoolean(r, Operators.notequal);
}
return this.compareWithNodeSet(r, Operators.notequal);
};
XNodeSet.prototype.lessthan = function(r) {
if (Utilities.instance_of(r, XString)) {
return this.compareWithNumber(r.number(), Operators.lessthan);
}
if (Utilities.instance_of(r, XNumber)) {
return this.compareWithNumber(r, Operators.lessthan);
}
if (Utilities.instance_of(r, XBoolean)) {
return this.compareWithBoolean(r, Operators.lessthan);
}
return this.compareWithNodeSet(r, Operators.lessthan);
};
XNodeSet.prototype.greaterthan = function(r) {
if (Utilities.instance_of(r, XString)) {
return this.compareWithNumber(r.number(), Operators.greaterthan);
}
if (Utilities.instance_of(r, XNumber)) {
return this.compareWithNumber(r, Operators.greaterthan);
}
if (Utilities.instance_of(r, XBoolean)) {
return this.compareWithBoolean(r, Operators.greaterthan);
}
return this.compareWithNodeSet(r, Operators.greaterthan);
};
XNodeSet.prototype.lessthanorequal = function(r) {
if (Utilities.instance_of(r, XString)) {
return this.compareWithNumber(r.number(), Operators.lessthanorequal);
}
if (Utilities.instance_of(r, XNumber)) {
return this.compareWithNumber(r, Operators.lessthanorequal);
}
if (Utilities.instance_of(r, XBoolean)) {
return this.compareWithBoolean(r, Operators.lessthanorequal);
}
return this.compareWithNodeSet(r, Operators.lessthanorequal);
};
XNodeSet.prototype.greaterthanorequal = function(r) {
if (Utilities.instance_of(r, XString)) {
return this.compareWithNumber(r.number(), Operators.greaterthanorequal);
}
if (Utilities.instance_of(r, XNumber)) {
return this.compareWithNumber(r, Operators.greaterthanorequal);
}
if (Utilities.instance_of(r, XBoolean)) {
return this.compareWithBoolean(r, Operators.greaterthanorequal);
}
return this.compareWithNodeSet(r, Operators.greaterthanorequal);
};
XNodeSet.prototype.union = function(r) {
var ns = new XNodeSet();
ns.tree = this.tree;
ns.size = this.size;
ns.addArray(r.toArray());
return ns;
};

XPathNamespace.prototype = new Object();
XPathNamespace.prototype.constructor = XPathNamespace;
XPathNamespace.superclass = Object.prototype;
function XPathNamespace(pre, ns, p) {
this.isXPathNamespace = true;
this.ownerDocument = p.ownerDocument;
this.nodeName = "#namespace";
this.prefix = pre;
this.localName = pre;
this.namespaceURI = ns;
this.nodeValue = ns;
this.ownerElement = p;
this.nodeType = XPathNamespace.XPATH_NAMESPACE_NODE;
}
XPathNamespace.prototype.toString = function() {
return "{ \"" + this.prefix + "\", \"" + this.namespaceURI + "\" }";
};

var Operators = new Object();
Operators.equals = function(l, r) {
return l.equals(r);
};
Operators.notequal = function(l, r) {
return l.notequal(r);
};
Operators.lessthan = function(l, r) {
return l.lessthan(r);
};
Operators.greaterthan = function(l, r) {
return l.greaterthan(r);
};
Operators.lessthanorequal = function(l, r) {
return l.lessthanorequal(r);
};
Operators.greaterthanorequal = function(l, r) {
return l.greaterthanorequal(r);
};

XPathContext.prototype = new Object();
XPathContext.prototype.constructor = XPathContext;
XPathContext.superclass = Object.prototype;
function XPathContext(vr, nr, fr) {
this.variableResolver = vr != null ? vr : new VariableResolver();
this.namespaceResolver = nr != null ? nr : new NamespaceResolver();
this.functionResolver = fr != null ? fr : new FunctionResolver();
}

VariableResolver.prototype = new Object();
VariableResolver.prototype.constructor = VariableResolver;
VariableResolver.superclass = Object.prototype;
function VariableResolver() {
}
VariableResolver.prototype.getVariable = function(vn, c) {
var parts = Utilities.splitQName(vn);
if (parts[0] != null) {
parts[0] = c.namespaceResolver.getNamespace(parts[0], c.expressionContextNode);
if (parts[0] == null) {
throw new Error("Cannot resolve QName " + fn);
}
}
return this.getVariableWithName(parts[0], parts[1], c.expressionContextNode);
};
VariableResolver.prototype.getVariableWithName = function(ns, ln, c) {
return null;
};

FunctionResolver.prototype = new Object();
FunctionResolver.prototype.constructor = FunctionResolver;
FunctionResolver.superclass = Object.prototype;
function FunctionResolver(thisArg) {
this.thisArg = thisArg != null ? thisArg : Functions;
this.functions = new Object();
this.addStandardFunctions();
}
FunctionResolver.prototype.addStandardFunctions = function() {
this.functions["{}last"] = Functions.last;
this.functions["{}position"] = Functions.position;
this.functions["{}count"] = Functions.count;
this.functions["{}id"] = Functions.id;
this.functions["{}local-name"] = Functions.localName;
this.functions["{}namespace-uri"] = Functions.namespaceURI;
this.functions["{}name"] = Functions.name;
this.functions["{}string"] = Functions.string;
this.functions["{}concat"] = Functions.concat;
this.functions["{}starts-with"] = Functions.startsWith;
this.functions["{}contains"] = Functions.contains;
this.functions["{}substring-before"] = Functions.substringBefore;
this.functions["{}substring-after"] = Functions.substringAfter;
this.functions["{}substring"] = Functions.substring;
this.functions["{}string-length"] = Functions.stringLength;
this.functions["{}normalize-space"] = Functions.normalizeSpace;
this.functions["{}translate"] = Functions.translate;
this.functions["{}boolean"] = Functions.boolean_;
this.functions["{}not"] = Functions.not;
this.functions["{}true"] = Functions.true_;
this.functions["{}false"] = Functions.false_;
this.functions["{}lang"] = Functions.lang;
this.functions["{}number"] = Functions.number;
this.functions["{}sum"] = Functions.sum;
this.functions["{}floor"] = Functions.floor;
this.functions["{}ceiling"] = Functions.ceiling;
this.functions["{}round"] = Functions.round;
};
FunctionResolver.prototype.addFunction = function(ns, ln, f) {
this.functions["{" + ns + "}" + ln] = f;
};
FunctionResolver.prototype.getFunction = function(fn, c) {
var parts = Utilities.resolveQName(fn, c.namespaceResolver, c.contextNode, false);
if (parts[0] == null) {
throw new Error("Cannot resolve QName " + fn);
}
return this.getFunctionWithName(parts[0], parts[1], c.contextNode);
};
FunctionResolver.prototype.getFunctionWithName = function(ns, ln, c) {
return this.functions["{" + ns + "}" + ln];
};

NamespaceResolver.prototype = new Object();
NamespaceResolver.prototype.constructor = NamespaceResolver;
NamespaceResolver.superclass = Object.prototype;
function NamespaceResolver() {
}
NamespaceResolver.prototype.getNamespace = function(prefix, n) {
if (prefix == "xml") {
return XPath.XML_NAMESPACE_URI;
} else if (prefix == "xmlns") {
return XPath.XMLNS_NAMESPACE_URI;
}
if (n.nodeType == 9 ) {
n = n.documentElement;
} else if (n.nodeType == 2 ) {
n = PathExpr.prototype.getOwnerElement(n);
} else if (n.nodeType != 1 ) {
n = n.parentNode;
}
while (n != null && n.nodeType == 1 ) {
var nnm = n.attributes;
for (var i = 0; i < nnm.length; i++) {
var a = nnm.item(i);
var aname = a.nodeName;
if (aname == "xmlns" && prefix == ""
|| aname == "xmlns:" + prefix) {
return String(a.nodeValue);
}
}
n = n.parentNode;
}
return null;
};

Functions = new Object();
Functions.last = function() {
var c = arguments[0];
if (arguments.length != 1) {
throw new Error("Function last expects ()");
}
return new XNumber(c.contextSize);
};
Functions.position = function() {
var c = arguments[0];
if (arguments.length != 1) {
throw new Error("Function position expects ()");
}
return new XNumber(c.contextPosition);
};
Functions.count = function() {
var c = arguments[0];
var ns;
if (arguments.length != 2 || !Utilities.instance_of(ns = arguments[1].evaluate(c), XNodeSet)) {
throw new Error("Function count expects (node-set)");
}
return new XNumber(ns.size);
};
Functions.id = function() {
var c = arguments[0];
var id;
if (arguments.length != 2) {
throw new Error("Function id expects (object)");
}
id = arguments[1].evaluate(c);
if (Utilities.instance_of(id, XNodeSet)) {
id = id.toArray().join(" ");
} else {
id = id.stringValue();
}
var ids = id.split(/[\x0d\x0a\x09\x20]+/);
var count = 0;
var ns = new XNodeSet();
var doc = c.contextNode.nodeType == 9 
? c.contextNode
: c.contextNode.ownerDocument;
for (var i = 0; i < ids.length; i++) {
var n;
if (doc.getElementById) {
n = doc.getElementById(ids[i]);
} else {
n = Utilities.getElementById(doc, ids[i]);
}
if (n != null) {
ns.add(n);
count++;
}
}
return ns;
};
Functions.localName = function() {
var c = arguments[0];
var n;
if (arguments.length == 1) {
n = c.contextNode;
} else if (arguments.length == 2) {
n = arguments[1].evaluate(c).first();
} else {
throw new Error("Function local-name expects (node-set?)");
}
if (n == null) {
return new XString("");
}
return new XString(n.localName ? n.localName : n.baseName);
};
Functions.namespaceURI = function() {
var c = arguments[0];
var n;
if (arguments.length == 1) {
n = c.contextNode;
} else if (arguments.length == 2) {
n = arguments[1].evaluate(c).first();
} else {
throw new Error("Function namespace-uri expects (node-set?)");
}
if (n == null) {
return new XString("");
}
return new XString(n.namespaceURI);
};
Functions.name = function() {
var c = arguments[0];
var n;
if (arguments.length == 1) {
n = c.contextNode;
} else if (arguments.length == 2) {
n = arguments[1].evaluate(c).first();
} else {
throw new Error("Function name expects (node-set?)");
}
if (n == null) {
return new XString("");
}
if (n.nodeType == 1  || n.nodeType == 2 ) {
return new XString(n.nodeName);
} else if (n.localName == null) {
return new XString("");
} else {
return new XString(n.localName);
}
};
Functions.string = function() {
var c = arguments[0];
if (arguments.length == 1) {
return XNodeSet.prototype.stringForNode(c.contextNode);
} else if (arguments.length == 2) {
return arguments[1].evaluate(c).string();
}
throw new Error("Function string expects (object?)");
};
Functions.concat = function() {
var c = arguments[0];
if (arguments.length < 3) {
throw new Error("Function concat expects (string, string, string*)");
}
var s = "";
for (var i = 1; i < arguments.length; i++) {
s += arguments[i].evaluate(c).stringValue();
}
return new XString(s);
};
Functions.startsWith = function() {
var c = arguments[0];
if (arguments.length != 3) {
throw new Error("Function startsWith expects (string, string)");
}
var s1 = arguments[1].evaluate(c).stringValue();
var s2 = arguments[2].evaluate(c).stringValue();
return new XBoolean(s1.substring(0, s2.length) == s2);
};
Functions.contains = function() {
var c = arguments[0];
if (arguments.length != 3) {
throw new Error("Function contains expects (string, string)");
}
var s1 = arguments[1].evaluate(c).stringValue();
var s2 = arguments[2].evaluate(c).stringValue();
return new XBoolean(s1.indexOf(s2) != -1);
};
Functions.substringBefore = function() {
var c = arguments[0];
if (arguments.length != 3) {
throw new Error("Function substring-before expects (string, string)");
}
var s1 = arguments[1].evaluate(c).stringValue();
var s2 = arguments[2].evaluate(c).stringValue();
return new XString(s1.substring(0, s1.indexOf(s2)));
};
Functions.substringAfter = function() {
var c = arguments[0];
if (arguments.length != 3) {
throw new Error("Function substring-after expects (string, string)");
}
var s1 = arguments[1].evaluate(c).stringValue();
var s2 = arguments[2].evaluate(c).stringValue();
if (s2.length == 0) {
return new XString(s1);
}
var i = s1.indexOf(s2);
if (i == -1) {
return new XString("");
}
return new XString(s1.substring(s1.indexOf(s2) + 1));
};
Functions.substring = function() {
var c = arguments[0];
if (!(arguments.length == 3 || arguments.length == 4)) {
throw new Error("Function substring expects (string, number, number?)");
}
var s = arguments[1].evaluate(c).stringValue();
var n1 = Math.round(arguments[2].evaluate(c).numberValue()) - 1;
var n2 = arguments.length == 4 ? n1 + Math.round(arguments[3].evaluate(c).numberValue()) : undefined;
return new XString(s.substring(n1, n2));
};
Functions.stringLength = function() {
var c = arguments[0];
var s;
if (arguments.length == 1) {
s = XNodeSet.prototype.stringForNode(c.contextNode);
} else if (arguments.length == 2) {
s = arguments[1].evaluate(c).stringValue();
} else {
throw new Error("Function string-length expects (string?)");
}
return new XNumber(s.length);
};
Functions.normalizeSpace = function() {
var c = arguments[0];
var s;
if (arguments.length == 1) {
s = XNodeSet.prototype.stringForNode(c.contextNode);
} else if (arguments.length == 2) {
s = arguments[1].evaluate(c).stringValue();
} else {
throw new Error("Function normalize-space expects (string?)");
}
var i = 0;
var j = s.length - 1;
while (Utilities.isSpace(s.charCodeAt(j))) {
j--;
}
var t = "";
while (i <= j && Utilities.isSpace(s.charCodeAt(i))) {
i++;
}
while (i <= j) {
if (Utilities.isSpace(s.charCodeAt(i))) {
t += " ";
while (i <= j && Utilities.isSpace(s.charCodeAt(i))) {
i++;
}
} else {
t += s.charAt(i);
i++;
}
}
return new XString(t);
};
Functions.translate = function() {
var c = arguments[0];
if (arguments.length != 4) {
throw new Error("Function translate expects (string, string, string)");
}
var s1 = arguments[1].evaluate(c).stringValue();
var s2 = arguments[2].evaluate(c).stringValue();
var s3 = arguments[3].evaluate(c).stringValue();
var map = [];
for (var i = 0; i < s2.length; i++) {
var j = s2.charCodeAt(i);
if (map[j] == undefined) {
var k = i > s3.length ? "" : s3.charAt(i);
map[j] = k;
}
}
var t = "";
for (var i = 0; i < s1.length; i++) {
var c = s1.charCodeAt(i);
var r = map[c];
if (r == undefined) {
t += s1.charAt(i);
} else {
t += r;
}
}
return new XString(t);
};
Functions.boolean_ = function() {
var c = arguments[0];
if (arguments.length != 2) {
throw new Error("Function boolean expects (object)");
}
return arguments[1].evaluate(c).bool();
};
Functions.not = function() {
var c = arguments[0];
if (arguments.length != 2) {
throw new Error("Function not expects (object)");
}
return arguments[1].evaluate(c).bool().not();
};
Functions.true_ = function() {
if (arguments.length != 1) {
throw new Error("Function true expects ()");
}
return new XBoolean(true);
};
Functions.false_ = function() {
if (arguments.length != 1) {
throw new Error("Function false expects ()");
}
return new XBoolean(false);
};
Functions.lang = function() {
var c = arguments[0];
if (arguments.length != 2) {
throw new Error("Function lang expects (string)");
}
var lang;
for (var n = c.contextNode; n != null && n.nodeType != 9 ; n = n.parentNode) {
var a = n.getAttributeNS(XPath.XML_NAMESPACE_URI, "lang");
if (a != null) {
lang = String(a);
break;
}
}
if (lang == null) {
return new XBoolean(false);
}
var s = arguments[1].evaluate(c).stringValue();
return new XBoolean(lang.substring(0, s.length) == s
&& (lang.length == s.length || lang.charAt(s.length) == '-'));
};
Functions.number = function() {
var c = arguments[0];
if (!(arguments.length == 1 || arguments.length == 2)) {
throw new Error("Function number expects (object?)");
}
if (arguments.length == 1) {
return new XNumber(XNodeSet.prototype.stringForNode(c.contextNode));
}
return arguments[1].evaluate(c).number();
};
Functions.sum = function() {
var c = arguments[0];
var ns;
if (arguments.length != 2 || !Utilities.instance_of((ns = arguments[1].evaluate(c)), XNodeSet)) {
throw new Error("Function sum expects (node-set)");
}
ns = ns.toArray();
var n = 0;
for (var i = 0; i < ns.length; i++) {
n += new XNumber(XNodeSet.prototype.stringForNode(ns[i])).numberValue();
}
return new XNumber(n);
};
Functions.floor = function() {
var c = arguments[0];
if (arguments.length != 2) {
throw new Error("Function floor expects (number)");
}
return new XNumber(Math.floor(arguments[1].evaluate(c).numberValue()));
};
Functions.ceiling = function() {
var c = arguments[0];
if (arguments.length != 2) {
throw new Error("Function ceiling expects (number)");
}
return new XNumber(Math.ceil(arguments[1].evaluate(c).numberValue()));
};
Functions.round = function() {
var c = arguments[0];
if (arguments.length != 2) {
throw new Error("Function round expects (number)");
}
return new XNumber(Math.round(arguments[1].evaluate(c).numberValue()));
};

Utilities = new Object();
Utilities.splitQName = function(qn) {
var i = qn.indexOf(":");
if (i == -1) {
return [ null, qn ];
}
return [ qn.substring(0, i), qn.substring(i + 1) ];
};
Utilities.resolveQName = function(qn, nr, n, useDefault) {
var parts = Utilities.splitQName(qn);
if (parts[0] != null) {
parts[0] = nr.getNamespace(parts[0], n);
} else {
if (useDefault) {
parts[0] = nr.getNamespace("", n);
if (parts[0] == null) {
parts[0] = "";
}
} else {
parts[0] = "";
}
}
return parts;
};
Utilities.isSpace = function(c) {
return c == 0x9 || c == 0xd || c == 0xa || c == 0x20;
};
Utilities.isLetter = function(c) {
return c >= 0x0041 && c <= 0x005A ||
c >= 0x0061 && c <= 0x007A ||
c >= 0x00C0 && c <= 0x00D6 ||
c >= 0x00D8 && c <= 0x00F6 ||
c >= 0x00F8 && c <= 0x00FF ||
c >= 0x0100 && c <= 0x0131 ||
c >= 0x0134 && c <= 0x013E ||
c >= 0x0141 && c <= 0x0148 ||
c >= 0x014A && c <= 0x017E ||
c >= 0x0180 && c <= 0x01C3 ||
c >= 0x01CD && c <= 0x01F0 ||
c >= 0x01F4 && c <= 0x01F5 ||
c >= 0x01FA && c <= 0x0217 ||
c >= 0x0250 && c <= 0x02A8 ||
c >= 0x02BB && c <= 0x02C1 ||
c == 0x0386 ||
c >= 0x0388 && c <= 0x038A ||
c == 0x038C ||
c >= 0x038E && c <= 0x03A1 ||
c >= 0x03A3 && c <= 0x03CE ||
c >= 0x03D0 && c <= 0x03D6 ||
c == 0x03DA ||
c == 0x03DC ||
c == 0x03DE ||
c == 0x03E0 ||
c >= 0x03E2 && c <= 0x03F3 ||
c >= 0x0401 && c <= 0x040C ||
c >= 0x040E && c <= 0x044F ||
c >= 0x0451 && c <= 0x045C ||
c >= 0x045E && c <= 0x0481 ||
c >= 0x0490 && c <= 0x04C4 ||
c >= 0x04C7 && c <= 0x04C8 ||
c >= 0x04CB && c <= 0x04CC ||
c >= 0x04D0 && c <= 0x04EB ||
c >= 0x04EE && c <= 0x04F5 ||
c >= 0x04F8 && c <= 0x04F9 ||
c >= 0x0531 && c <= 0x0556 ||
c == 0x0559 ||
c >= 0x0561 && c <= 0x0586 ||
c >= 0x05D0 && c <= 0x05EA ||
c >= 0x05F0 && c <= 0x05F2 ||
c >= 0x0621 && c <= 0x063A ||
c >= 0x0641 && c <= 0x064A ||
c >= 0x0671 && c <= 0x06B7 ||
c >= 0x06BA && c <= 0x06BE ||
c >= 0x06C0 && c <= 0x06CE ||
c >= 0x06D0 && c <= 0x06D3 ||
c == 0x06D5 ||
c >= 0x06E5 && c <= 0x06E6 ||
c >= 0x0905 && c <= 0x0939 ||
c == 0x093D ||
c >= 0x0958 && c <= 0x0961 ||
c >= 0x0985 && c <= 0x098C ||
c >= 0x098F && c <= 0x0990 ||
c >= 0x0993 && c <= 0x09A8 ||
c >= 0x09AA && c <= 0x09B0 ||
c == 0x09B2 ||
c >= 0x09B6 && c <= 0x09B9 ||
c >= 0x09DC && c <= 0x09DD ||
c >= 0x09DF && c <= 0x09E1 ||
c >= 0x09F0 && c <= 0x09F1 ||
c >= 0x0A05 && c <= 0x0A0A ||
c >= 0x0A0F && c <= 0x0A10 ||
c >= 0x0A13 && c <= 0x0A28 ||
c >= 0x0A2A && c <= 0x0A30 ||
c >= 0x0A32 && c <= 0x0A33 ||
c >= 0x0A35 && c <= 0x0A36 ||
c >= 0x0A38 && c <= 0x0A39 ||
c >= 0x0A59 && c <= 0x0A5C ||
c == 0x0A5E ||
c >= 0x0A72 && c <= 0x0A74 ||
c >= 0x0A85 && c <= 0x0A8B ||
c == 0x0A8D ||
c >= 0x0A8F && c <= 0x0A91 ||
c >= 0x0A93 && c <= 0x0AA8 ||
c >= 0x0AAA && c <= 0x0AB0 ||
c >= 0x0AB2 && c <= 0x0AB3 ||
c >= 0x0AB5 && c <= 0x0AB9 ||
c == 0x0ABD ||
c == 0x0AE0 ||
c >= 0x0B05 && c <= 0x0B0C ||
c >= 0x0B0F && c <= 0x0B10 ||
c >= 0x0B13 && c <= 0x0B28 ||
c >= 0x0B2A && c <= 0x0B30 ||
c >= 0x0B32 && c <= 0x0B33 ||
c >= 0x0B36 && c <= 0x0B39 ||
c == 0x0B3D ||
c >= 0x0B5C && c <= 0x0B5D ||
c >= 0x0B5F && c <= 0x0B61 ||
c >= 0x0B85 && c <= 0x0B8A ||
c >= 0x0B8E && c <= 0x0B90 ||
c >= 0x0B92 && c <= 0x0B95 ||
c >= 0x0B99 && c <= 0x0B9A ||
c == 0x0B9C ||
c >= 0x0B9E && c <= 0x0B9F ||
c >= 0x0BA3 && c <= 0x0BA4 ||
c >= 0x0BA8 && c <= 0x0BAA ||
c >= 0x0BAE && c <= 0x0BB5 ||
c >= 0x0BB7 && c <= 0x0BB9 ||
c >= 0x0C05 && c <= 0x0C0C ||
c >= 0x0C0E && c <= 0x0C10 ||
c >= 0x0C12 && c <= 0x0C28 ||
c >= 0x0C2A && c <= 0x0C33 ||
c >= 0x0C35 && c <= 0x0C39 ||
c >= 0x0C60 && c <= 0x0C61 ||
c >= 0x0C85 && c <= 0x0C8C ||
c >= 0x0C8E && c <= 0x0C90 ||
c >= 0x0C92 && c <= 0x0CA8 ||
c >= 0x0CAA && c <= 0x0CB3 ||
c >= 0x0CB5 && c <= 0x0CB9 ||
c == 0x0CDE ||
c >= 0x0CE0 && c <= 0x0CE1 ||
c >= 0x0D05 && c <= 0x0D0C ||
c >= 0x0D0E && c <= 0x0D10 ||
c >= 0x0D12 && c <= 0x0D28 ||
c >= 0x0D2A && c <= 0x0D39 ||
c >= 0x0D60 && c <= 0x0D61 ||
c >= 0x0E01 && c <= 0x0E2E ||
c == 0x0E30 ||
c >= 0x0E32 && c <= 0x0E33 ||
c >= 0x0E40 && c <= 0x0E45 ||
c >= 0x0E81 && c <= 0x0E82 ||
c == 0x0E84 ||
c >= 0x0E87 && c <= 0x0E88 ||
c == 0x0E8A ||
c == 0x0E8D ||
c >= 0x0E94 && c <= 0x0E97 ||
c >= 0x0E99 && c <= 0x0E9F ||
c >= 0x0EA1 && c <= 0x0EA3 ||
c == 0x0EA5 ||
c == 0x0EA7 ||
c >= 0x0EAA && c <= 0x0EAB ||
c >= 0x0EAD && c <= 0x0EAE ||
c == 0x0EB0 ||
c >= 0x0EB2 && c <= 0x0EB3 ||
c == 0x0EBD ||
c >= 0x0EC0 && c <= 0x0EC4 ||
c >= 0x0F40 && c <= 0x0F47 ||
c >= 0x0F49 && c <= 0x0F69 ||
c >= 0x10A0 && c <= 0x10C5 ||
c >= 0x10D0 && c <= 0x10F6 ||
c == 0x1100 ||
c >= 0x1102 && c <= 0x1103 ||
c >= 0x1105 && c <= 0x1107 ||
c == 0x1109 ||
c >= 0x110B && c <= 0x110C ||
c >= 0x110E && c <= 0x1112 ||
c == 0x113C ||
c == 0x113E ||
c == 0x1140 ||
c == 0x114C ||
c == 0x114E ||
c == 0x1150 ||
c >= 0x1154 && c <= 0x1155 ||
c == 0x1159 ||
c >= 0x115F && c <= 0x1161 ||
c == 0x1163 ||
c == 0x1165 ||
c == 0x1167 ||
c == 0x1169 ||
c >= 0x116D && c <= 0x116E ||
c >= 0x1172 && c <= 0x1173 ||
c == 0x1175 ||
c == 0x119E ||
c == 0x11A8 ||
c == 0x11AB ||
c >= 0x11AE && c <= 0x11AF ||
c >= 0x11B7 && c <= 0x11B8 ||
c == 0x11BA ||
c >= 0x11BC && c <= 0x11C2 ||
c == 0x11EB ||
c == 0x11F0 ||
c == 0x11F9 ||
c >= 0x1E00 && c <= 0x1E9B ||
c >= 0x1EA0 && c <= 0x1EF9 ||
c >= 0x1F00 && c <= 0x1F15 ||
c >= 0x1F18 && c <= 0x1F1D ||
c >= 0x1F20 && c <= 0x1F45 ||
c >= 0x1F48 && c <= 0x1F4D ||
c >= 0x1F50 && c <= 0x1F57 ||
c == 0x1F59 ||
c == 0x1F5B ||
c == 0x1F5D ||
c >= 0x1F5F && c <= 0x1F7D ||
c >= 0x1F80 && c <= 0x1FB4 ||
c >= 0x1FB6 && c <= 0x1FBC ||
c == 0x1FBE ||
c >= 0x1FC2 && c <= 0x1FC4 ||
c >= 0x1FC6 && c <= 0x1FCC ||
c >= 0x1FD0 && c <= 0x1FD3 ||
c >= 0x1FD6 && c <= 0x1FDB ||
c >= 0x1FE0 && c <= 0x1FEC ||
c >= 0x1FF2 && c <= 0x1FF4 ||
c >= 0x1FF6 && c <= 0x1FFC ||
c == 0x2126 ||
c >= 0x212A && c <= 0x212B ||
c == 0x212E ||
c >= 0x2180 && c <= 0x2182 ||
c >= 0x3041 && c <= 0x3094 ||
c >= 0x30A1 && c <= 0x30FA ||
c >= 0x3105 && c <= 0x312C ||
c >= 0xAC00 && c <= 0xD7A3 ||
c >= 0x4E00 && c <= 0x9FA5 ||
c == 0x3007 ||
c >= 0x3021 && c <= 0x3029;
};
Utilities.isNCNameChar = function(c) {
return c >= 0x0030 && c <= 0x0039 
|| c >= 0x0660 && c <= 0x0669 
|| c >= 0x06F0 && c <= 0x06F9 
|| c >= 0x0966 && c <= 0x096F 
|| c >= 0x09E6 && c <= 0x09EF 
|| c >= 0x0A66 && c <= 0x0A6F 
|| c >= 0x0AE6 && c <= 0x0AEF 
|| c >= 0x0B66 && c <= 0x0B6F 
|| c >= 0x0BE7 && c <= 0x0BEF 
|| c >= 0x0C66 && c <= 0x0C6F 
|| c >= 0x0CE6 && c <= 0x0CEF 
|| c >= 0x0D66 && c <= 0x0D6F 
|| c >= 0x0E50 && c <= 0x0E59 
|| c >= 0x0ED0 && c <= 0x0ED9 
|| c >= 0x0F20 && c <= 0x0F29
|| c == 0x002E
|| c == 0x002D
|| c == 0x005F
|| Utilities.isLetter(c)
|| c >= 0x0300 && c <= 0x0345 
|| c >= 0x0360 && c <= 0x0361 
|| c >= 0x0483 && c <= 0x0486 
|| c >= 0x0591 && c <= 0x05A1 
|| c >= 0x05A3 && c <= 0x05B9 
|| c >= 0x05BB && c <= 0x05BD 
|| c == 0x05BF 
|| c >= 0x05C1 && c <= 0x05C2 
|| c == 0x05C4 
|| c >= 0x064B && c <= 0x0652 
|| c == 0x0670 
|| c >= 0x06D6 && c <= 0x06DC 
|| c >= 0x06DD && c <= 0x06DF 
|| c >= 0x06E0 && c <= 0x06E4 
|| c >= 0x06E7 && c <= 0x06E8 
|| c >= 0x06EA && c <= 0x06ED 
|| c >= 0x0901 && c <= 0x0903 
|| c == 0x093C 
|| c >= 0x093E && c <= 0x094C 
|| c == 0x094D 
|| c >= 0x0951 && c <= 0x0954 
|| c >= 0x0962 && c <= 0x0963 
|| c >= 0x0981 && c <= 0x0983 
|| c == 0x09BC 
|| c == 0x09BE 
|| c == 0x09BF 
|| c >= 0x09C0 && c <= 0x09C4 
|| c >= 0x09C7 && c <= 0x09C8 
|| c >= 0x09CB && c <= 0x09CD 
|| c == 0x09D7 
|| c >= 0x09E2 && c <= 0x09E3 
|| c == 0x0A02 
|| c == 0x0A3C 
|| c == 0x0A3E 
|| c == 0x0A3F 
|| c >= 0x0A40 && c <= 0x0A42 
|| c >= 0x0A47 && c <= 0x0A48 
|| c >= 0x0A4B && c <= 0x0A4D 
|| c >= 0x0A70 && c <= 0x0A71 
|| c >= 0x0A81 && c <= 0x0A83 
|| c == 0x0ABC 
|| c >= 0x0ABE && c <= 0x0AC5 
|| c >= 0x0AC7 && c <= 0x0AC9 
|| c >= 0x0ACB && c <= 0x0ACD 
|| c >= 0x0B01 && c <= 0x0B03 
|| c == 0x0B3C 
|| c >= 0x0B3E && c <= 0x0B43 
|| c >= 0x0B47 && c <= 0x0B48 
|| c >= 0x0B4B && c <= 0x0B4D 
|| c >= 0x0B56 && c <= 0x0B57 
|| c >= 0x0B82 && c <= 0x0B83 
|| c >= 0x0BBE && c <= 0x0BC2 
|| c >= 0x0BC6 && c <= 0x0BC8 
|| c >= 0x0BCA && c <= 0x0BCD 
|| c == 0x0BD7 
|| c >= 0x0C01 && c <= 0x0C03 
|| c >= 0x0C3E && c <= 0x0C44 
|| c >= 0x0C46 && c <= 0x0C48 
|| c >= 0x0C4A && c <= 0x0C4D 
|| c >= 0x0C55 && c <= 0x0C56 
|| c >= 0x0C82 && c <= 0x0C83 
|| c >= 0x0CBE && c <= 0x0CC4 
|| c >= 0x0CC6 && c <= 0x0CC8 
|| c >= 0x0CCA && c <= 0x0CCD 
|| c >= 0x0CD5 && c <= 0x0CD6 
|| c >= 0x0D02 && c <= 0x0D03 
|| c >= 0x0D3E && c <= 0x0D43 
|| c >= 0x0D46 && c <= 0x0D48 
|| c >= 0x0D4A && c <= 0x0D4D 
|| c == 0x0D57 
|| c == 0x0E31 
|| c >= 0x0E34 && c <= 0x0E3A 
|| c >= 0x0E47 && c <= 0x0E4E 
|| c == 0x0EB1 
|| c >= 0x0EB4 && c <= 0x0EB9 
|| c >= 0x0EBB && c <= 0x0EBC 
|| c >= 0x0EC8 && c <= 0x0ECD 
|| c >= 0x0F18 && c <= 0x0F19 
|| c == 0x0F35 
|| c == 0x0F37 
|| c == 0x0F39 
|| c == 0x0F3E 
|| c == 0x0F3F 
|| c >= 0x0F71 && c <= 0x0F84 
|| c >= 0x0F86 && c <= 0x0F8B 
|| c >= 0x0F90 && c <= 0x0F95 
|| c == 0x0F97 
|| c >= 0x0F99 && c <= 0x0FAD 
|| c >= 0x0FB1 && c <= 0x0FB7 
|| c == 0x0FB9 
|| c >= 0x20D0 && c <= 0x20DC 
|| c == 0x20E1 
|| c >= 0x302A && c <= 0x302F 
|| c == 0x3099 
|| c == 0x309A
|| c == 0x00B7 
|| c == 0x02D0 
|| c == 0x02D1 
|| c == 0x0387 
|| c == 0x0640 
|| c == 0x0E46 
|| c == 0x0EC6 
|| c == 0x3005 
|| c >= 0x3031 && c <= 0x3035 
|| c >= 0x309D && c <= 0x309E 
|| c >= 0x30FC && c <= 0x30FE;
};
Utilities.coalesceText = function(n) {
for (var m = n.firstChild; m != null; m = m.nextSibling) {
if (m.nodeType == 3  || m.nodeType == 4 ) {
var s = m.nodeValue;
var first = m;
m = m.nextSibling;
while (m != null && (m.nodeType == 3  || m.nodeType == 4 )) {
s += m.nodeValue;
var del = m;
m = m.nextSibling;
del.parentNode.removeChild(del);
}
if (first.nodeType == 4 ) {
var p = first.parentNode;
if (first.nextSibling == null) {
p.removeChild(first);
p.appendChild(p.ownerDocument.createTextNode(s));
} else {
var next = first.nextSibling;
p.removeChild(first);
p.insertBefore(p.ownerDocument.createTextNode(s), next);
}
} else {
first.nodeValue = s;
}
if (m == null) {
break;
}
} else if (m.nodeType == 1 ) {
Utilities.coalesceText(m);
}
}
};
Utilities.instance_of = function(o, c) {
while (o != null) {
if (o.constructor === c) {
return true;
}
if (o === Object) {
return false;
}
o = o.constructor.superclass;
}
return false;
};
Utilities.getElementById = function(n, id) {


if (n.nodeType == 1 ) {
if (n.getAttribute("id") == id
|| n.getAttributeNS(null, "id") == id) {
return n;
}
}
for (var m = n.firstChild; m != null; m = m.nextSibling) {
var res = Utilities.getElementById(m, id);
if (res != null) {
return res;
}
}
return null;
};

XPathException.prototype = {};
XPathException.prototype.constructor = XPathException;
XPathException.superclass = Object.prototype;
function XPathException(c, e) {
this.code = c;
this.exception = e;
}
XPathException.prototype.toString = function() {
var msg = this.exception ? ": " + this.exception.toString() : "";
switch (this.code) {
case XPathException.INVALID_EXPRESSION_ERR:
return "Invalid expression" + msg;
case XPathException.TYPE_ERR:
return "Type error" + msg;
}
};
XPathException.INVALID_EXPRESSION_ERR = 51;
XPathException.TYPE_ERR = 52;

XPathExpression.prototype = {};
XPathExpression.prototype.constructor = XPathExpression;
XPathExpression.superclass = Object.prototype;
function XPathExpression(e, r, p) {
this.xpath = p.parse(e);
this.context = new XPathContext();
this.context.namespaceResolver = new XPathNSResolverWrapper(r);
}
XPathExpression.prototype.evaluate = function(n, t, res) {
this.context.expressionContextNode = n;
var result = this.xpath.evaluate(this.context);
return new XPathResult(result, t);
}

XPathNSResolverWrapper.prototype = {};
XPathNSResolverWrapper.prototype.constructor = XPathNSResolverWrapper;
XPathNSResolverWrapper.superclass = Object.prototype;
function XPathNSResolverWrapper(r) {
this.xpathNSResolver = r;
}
XPathNSResolverWrapper.prototype.getNamespace = function(prefix, n) {
if (this.xpathNSResolver == null) {
return null;
}
return this.xpathNSResolver.lookupNamespaceURI(prefix);
};

NodeXPathNSResolver.prototype = {};
NodeXPathNSResolver.prototype.constructor = NodeXPathNSResolver;
NodeXPathNSResolver.superclass = Object.prototype;
function NodeXPathNSResolver(n) {
this.node = n;
this.namespaceResolver = new NamespaceResolver();
}
NodeXPathNSResolver.prototype.lookupNamespaceURI = function(prefix) {
return this.namespaceResolver.getNamespace(prefix, this.node);
};

XPathResult.prototype = {};
XPathResult.prototype.constructor = XPathResult;
XPathResult.superclass = Object.prototype;
function XPathResult(v, t) {
if (t == XPathResult.ANY_TYPE) {
if (v.constructor === XString) {
t = XPathResult.STRING_TYPE;
} else if (v.constructor === XNumber) {
t = XPathResult.NUMBER_TYPE;
} else if (v.constructor === XBoolean) {
t = XPathResult.BOOLEAN_TYPE;
} else if (v.constructor === XNodeSet) {
t = XPathResult.UNORDERED_NODE_ITERATOR_TYPE;
}
}
this.resultType = t;
switch (t) {
case XPathResult.NUMBER_TYPE:
this.numberValue = v.numberValue();
return;
case XPathResult.STRING_TYPE:
this.stringValue = v.stringValue();
return;
case XPathResult.BOOLEAN_TYPE:
this.booleanValue = v.booleanValue();
return;
case XPathResult.ANY_UNORDERED_NODE_TYPE:
case XPathResult.FIRST_ORDERED_NODE_TYPE:
if (v.constructor === XNodeSet) {
this.singleNodeValue = v.first();
return;
}
break;
case XPathResult.UNORDERED_NODE_ITERATOR_TYPE:
case XPathResult.ORDERED_NODE_ITERATOR_TYPE:
if (v.constructor === XNodeSet) {
this.invalidIteratorState = false;
this.nodes = v.toArray();
this.iteratorIndex = 0;
return;
}
break;
case XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE:
case XPathResult.ORDERED_NODE_SNAPSHOT_TYPE:
if (v.constructor === XNodeSet) {
this.nodes = v.toArray();
this.snapshotLength = this.nodes.length;
return;
}
break;
}
throw new XPathException(XPathException.TYPE_ERR);
};
XPathResult.prototype.iterateNext = function() {
if (this.resultType != XPathResult.UNORDERED_NODE_ITERATOR_TYPE
&& this.resultType != XPathResult.ORDERED_NODE_ITERATOR_TYPE) {
throw new XPathException(XPathException.TYPE_ERR);
}
return this.nodes[this.iteratorIndex++];
};
XPathResult.prototype.snapshotItem = function(i) {
if (this.resultType != XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE
&& this.resultType != XPathResult.ORDERED_NODE_SNAPSHOT_TYPE) {
throw new XPathException(XPathException.TYPE_ERR);
}
return this.nodes[i];
};
XPathResult.ANY_TYPE = 0;
XPathResult.NUMBER_TYPE = 1;
XPathResult.STRING_TYPE = 2;
XPathResult.BOOLEAN_TYPE = 3;
XPathResult.UNORDERED_NODE_ITERATOR_TYPE = 4;
XPathResult.ORDERED_NODE_ITERATOR_TYPE = 5;
XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE = 6;
XPathResult.ORDERED_NODE_SNAPSHOT_TYPE = 7;
XPathResult.ANY_UNORDERED_NODE_TYPE = 8;
XPathResult.FIRST_ORDERED_NODE_TYPE = 9;

function installDOM3XPathSupport(doc, p) {
doc.createExpression = function(e, r) {
try {
return new XPathExpression(e, r, p);
} catch (e) {
throw new XPathException(XPathException.INVALID_EXPRESSION_ERR, e);
}
};
doc.createNSResolver = function(n) {
return new NodeXPathNSResolver(n);
};
doc.evaluate = function(e, cn, r, t, res) {
if (t < 0 || t > 9) {
throw { code: 0, toString: function() { return "Request type not supported"; } };
}
return doc.createExpression(e, r, p).evaluate(cn, t, res);
};
};


try {
var shouldInstall = true;
try {
if (document.implementation
&& document.implementation.hasFeature
&& document.implementation.hasFeature("XPath", null)) {
shouldInstall = false;
}
} catch (e) {
}
if (shouldInstall) {
installDOM3XPathSupport(document, new XPathParser());
}
} catch (e) {
}
function SelectNodes(doc, xpath)
{
var parser = new XPathParser();
var xpath = parser.parse(xpath);
var context = new XPathContext();
if(doc.documentElement){
context.expressionContextNode = doc.documentElement;
} else {
context.expressionContextNode = doc;
}
var res = xpath.evaluate(context)
return res.toArray();
}
module.exports = SelectNodes;
}
,
function(exports,require,module){var DOCUMENT_LAYOUT_PROCESSED = "http://www.xidea.org/lite/core/c:layout-processed";
var HTML_URI = "http://www.w3.org/1999/xhtml"
var setNodeURI = require(39).setNodeURI
var parseChildRemoveAttr = require(39).parseChildRemoveAttr
var findXMLAttribute = require(8).findXMLAttribute
var wrapScript = require(24).wrapScript;
var PLUGIN_MODULE = "org.xidea.lite.ModulePlugin"
exports.parse$9 = parseDocument;
exports.parseExtends = exports.interceptExtends = processExtends


exports.parseBlock = exports.interceptBlock = processBlock;
exports.parseWidget = exports.interceptWidget =processWidget;
exports.parseLazyWidget = exports.interceptLazyWidget =processWidget;


function parseDocument(doc,ns){
var isProcessed = this.getAttribute(DOCUMENT_LAYOUT_PROCESSED);

if(!isProcessed){
this.setAttribute(DOCUMENT_LAYOUT_PROCESSED,true);
var root = doc.documentElement;
var ln = root.localName || root.nodeName.replace(/^w+\:/,'');
if((ln == 'extends' || ln == 'extend') && root.namespaceURI == ns){
processExtends.call(this,root);
return ;
}else{
try{
var attr = root.getAttributeNodeNS(ns,"extends") || root.getAttributeNodeNS(ns,"extend");
}catch(e){
var attrs = root.attributes;
var i = attrs.length-1;
while(i-->0){
var a = attrs.item(i);
if(a.namespaceURI == ns && /^(?:w+\:)?extends?$/.test(a.nodeName)){
attr = a;
break;
}
}
}
if(attr != null){
processExtends.call(this,attr);
return ;
}
var layout = this.configMap.layout;
if(layout){
var uri = this.createURI(layout);
if(uri != String(this.currentURI)){
this.setAttribute('$page',doc);



this.parse(uri);
}
return ;
}
}
}
this.next(doc);
}
function processExtends(node){
var oldConfig = this.getAttribute("#extends");
var el = node.nodeType == 1?node:node.ownerElement|| node.selectSingleNode('..');
var root = el == el.ownerDocument.documentElement;
var extendsConfig = {blockMap:{},parse:false,root:root};
if(oldConfig){
if(oldConfig.parse){
if(root){
if(extendsConfig.root){

}
extendsConfig = oldConfig;
extendsConfig.parse = false;
}else{
extendsConfig.root = false;
}
}else{
return;
}
}
this.setAttribute("#extends" ,extendsConfig);
var parentURI = findXMLAttribute(node,"*path","value","parent");

var uri = this.createURI(parentURI);
var parentNode = this.loadXML(uri);
if(!root){
parentNode = parentNode.documentElement;
}
var i = this.mark();
parseChildRemoveAttr(this,node);
this.reset(i);
var parentURI = this.currentURI;
try{
this.setCurrentURI(uri);
extendsConfig.parse=true;
this.parse(parentNode);
}finally{
this.setCurrentURI(parentURI);
}
this.setAttribute("#extends" ,oldConfig);
}
function processBlock(node){
var extendsConfig = this.getAttribute("#extends");
var value = findXMLAttribute(node,"name","id");
if(extendsConfig){
var blockMap = extendsConfig.blockMap;
var cached = value && (value in blockMap) && blockMap[value];
if(extendsConfig.parse){
if(cached){
var parentURI = this.currentURI;
try{

setNodeURI(this,cached);
extendsConfig.parse=true;

_parseBlock(this,cached);
}finally{
this.setCurrentURI(parentURI);
}
}else{

_parseBlock(this,node);
}
}else{
if(!cached){
blockMap[value] = node;
}
}
}else{
_parseBlock(this,node);
}
}
function loadText(ctx,path){
var uri = ctx.createURI(path);
return ctx.loadText(uri);
}
function processWidget(node){
var ctx = this;
var lazy = node.nodeName.match(/lazy/i);
var currentURI = ctx.currentURI;
var src = findXMLAttribute(node,"path");
var uri = ctx.createURI(src);
var doc = ctx.loadXML(uri);

var cssPath = src.replace(/\.\w+$/,'.css');
var jsPath = src.replace(/\.\w+$/,'.js');
var fragment = doc.createDocumentFragment();
var body = doc.getElementsByTagName('body')[0];
var resources = doc.getElementsByTagName('link');
var i= resources.length-1
while(i-->0){
var res = resources[i];
res.parentNode && res.parentNode.removeChild(res);
fragment.appendChild(res)
}
var source = loadText(ctx,cssPath);
if(source){
var s = doc.createElementNS(HTML_URI,'link');

s.setAttribute('rel','stylesheet');
s.setAttribute('type','text/css');
s.setAttribute('href',cssPath);

fragment.appendChild(s)
}
if(body){
var res = body.firstChild;

while(res!=null){

var next = res.nextSibling;
fragment.appendChild(res)
res = next;
}
body.parentNode.removeChild(body)
var resources = doc.getElementsByTagName('script');
var i= resources.length-1
while(i-->0){
var res = resources[i];
res.parentNode && res.parentNode.removeChild(res);
fragment.appendChild(res)
}
}else{
fragment.appendChild(doc.documentElement)
}
var source = loadText(ctx,jsPath);
if(source){
var s = doc.createElementNS(HTML_URI,'script');

source = wrapScript(source,'__define_run__')
s.appendChild(doc.createTextNode(source));
fragment.appendChild(s)
}
try{
node.nodeType == 1 && node.removeAttribute('path');
if(lazy){
var config={};
var tagName = _appendLazyStart(ctx,node,config);
parseChildRemoveAttr(ctx,node);
tagName && ctx.appendText('</'+tagName+'>')
ctx.appendPlugin(PLUGIN_MODULE,JSON.stringify(config));
this.parse(fragment);
ctx.appendEnd();
}else{
this.parse(fragment);
}
}finally{
this.currentURI = currentURI;
}
}

function parseLazyWidget(node){
}
function _parseBlock(ctx,node){
if(!node.nodeName.match(/lazy/i)){
parseChildRemoveAttr(ctx,node);
}else{
var config={};
var tagName = _appendLazyStart(ctx,node,config);
ctx.appendPlugin(PLUGIN_MODULE,JSON.stringify(config));
parseChildRemoveAttr(ctx,node);
ctx.appendEnd();
tagName && ctx.append('</'+tagName+'>')
}
}
function _appendLazyStart(ctx,node,config){
var blockId = genBlockID(ctx);

if(node.nodeType == 1){
var attrs = node.attributes ;
for(var i=0,len = attrs.length;i<len;i++){
var a = attrs.item(i);
var n = a.name;
if(!n.match(/\:|^id$/i)){
config[n] = a.value;
}
}
ctx.appendText('<div data-lazy-widget-id="',blockId,'"');
for(var n in config){
ctx.appendText(' ',n,'="',config[n],'"');
}
ctx.appendText('>')
config.id=blockId
return 'div';
}else{
node.ownerElement.setAttribute('data-lazy-widget-id',blockId);
config.id=blockId
}
}
function genBlockID(ctx){
var oldId = ctx.__increaceBlockID||0;;
return ctx.__increaceBlockID = ++oldId
}
}
,
function(exports,require){
var findELEnd=require(38).findELEnd;
var PLUGIN_DEFINE=require(14).PLUGIN_DEFINE;
var parseDefName = require(39).parseDefName;
var findLiteParamMap=require(39).findLiteParamMap;
var appendForStart = require(39).appendForStart;
exports.seekxa = function(text){
var end = findELEnd(text,0);
if(end>0){
try{
var el = text.substring(1,end);
if(/^\s*([\w\-]+|"[^"]+"|'[^']+')\s*\:/.test(el)){
var map = findLiteParamMap(el);
for(var n in map){
this.appendXA(n,map[n]);
}
}else{
this.appendXA(null,el)
}
return end;
}catch(e){
console.error("XML属性表达式解析异常，请检查是否手误：[fileName:"+this.currentURI+",el:"+el+"]",e)
return -1;
}
}else{
console.warn("XML属性表达式解析异常，请检查是否手误：[fileName:"+this.currentURI+",el:"+el+"]")
return -1;
}
};
exports.seekxt = function(text){
var end = findELEnd(text,0);
if(end>0){
try{
var el = text.substring(1,end);
this.appendXT(el)
return end;
}catch(e){
console.error("XML文本表达式解析异常，请检查是否手误：[fileName:"+this.currentURI+",el:"+el+"]",e)
return -1;
}
}else{
console.warn("XML文本表达式解析异常，请检查是否手误：[fileName:"+this.currentURI+",el:"+el+"]")
return -1;
}
}
exports.seekEnd= function(){
this.appendEnd();
return 0;
}
exports.seekDef=function (text){
var end = findELEnd(text);
if(end>0){
var ns = text.substring(1,end);
var config = parseDefName(ns);
this.appendPlugin(PLUGIN_DEFINE,JSON.stringify(config));
return end;
}
}
exports.seekVar=function (text){
var end = findELEnd(text);
if(end>0){
var value = text.substring(1,end);
if(/^\s*(?:\w+|['"][^"]+['"])\s*$/.test(value)){
this.appendCapture(value.replace(/['"]/g,''));
}else{
var map = findLiteParamMap(value);
for(var n in map){
this.appendVar(n,map[n]);
}
}
return end;
}
}
exports.seekClient= function(text){
var end = findELEnd(text);
if(end>0){
var ns = text.substring(1,end);
var config = parseDefName(ns);
this.appendPlugin("org.xidea.lite.parse.ClientPlugin",JSON.stringify(config));
return end;
}
}
exports.seekIf=function (text){
var end = findELEnd(text,0);
if(end>0){
this.appendIf(text.substring(1,end));
return end;
}
}
exports.seekElse=function (text){
if(text.charAt() == '$'){
this.appendEnd();
this.appendElse(null);
return 0;
}else{
var end = findELEnd(text);
if(end>0){
this.appendEnd();
this.appendElse(text.substring(1,end)||null);
return end;
}
}
}
exports.seekElif=function (text){
var end = findELEnd(text);
if(end>0){
this.appendEnd();
this.appendElse(text.substring(1,end)||null);
return end;
}
}
exports.seekFor=function (text){
var end = findELEnd(text);
if(end>0){
var value = text.substring(1,end);
appendForStart(this,value);
return end;
}
}
exports.seekOut=function (text){
var end = findELEnd(text);
if(end>0){
var value = text.substring(1,end);
this.appendEL(value);
return end;
}
}
}
,
function(exports,require){

function parseConfig(doc){
if(typeof doc == 'string'){doc = loadLiteXML(doc)}
var lites = doc.getElementsByTagName("lite");
var len = lites.length;

if(len >= 1){
var root = new LiteGroup(lites.item(0))
if(len>1){
console.error("配置文件只允许一个lite节点","您的文档中包含"+len+"个节点，后续节点将作为第一个节点子节点解析。");
for(var i=1;i<len;i++){
root.children.push(new LiteGroup(lites[i],this));
}
}
var json = root.toJSON();
return json;
}
return null
}
function LiteGroup(node,parentConfig){
this.parentConfig = parentConfig || null
this.config = {}
this.encoding= findXMLAttribute(node,'encoding','charset');
this.type = findXMLAttribute(node,'type',"mime-type",'mimeType');
this.contentType = findXMLAttribute(node,'contentType','contextType');
this.layout = findXMLAttribute(node,'layout');
this.extensionMap = {};
this.children = [];
this.includes = [];
this.excludes = [];
var child = node.firstChild;
while(child){
if(child.nodeType == 1){
switch(child.nodeName){
case 'feature':
case 'attribute':
case 'config':
this.config[findXMLAttribute(child,'name','key','uri','url')] = 
findXMLAttribute(child,'value','#text')
break;
case 'extension':
var ns = findXMLAttribute(child,'namespace','name','key','uri','url');
var p = findXMLAttribute(child,'package','impl','value','#text');
var ps = this.extensionMap[ns];
if(ps && ps instanceof Array){
appendAfter(ps,p);
}else{
this.extensionMap[ns] = [p];
}
break;
case 'include':
this.includes.push(findXMLAttribute(child,'value','#text','pattern'));
break;
case 'exclude':
this.excludes.push(findXMLAttribute(child,'value','#text','pattern'));
break;
case 'group':
this.children.push(new LiteGroup(child,this))
break;
default:
console.warn("unknow nodeName:"+child.nodeName);
}
}
child = child.nextSibling;
}
}
LiteGroup.prototype.toJSON = function(){
var result = [];
var len = this.children.length;
var json = {}
this.initialize();
for(var i=0;i<len;i++){
result.push.apply(result,this.children[i].toJSON());
}
json.includes = this.includes;
json.excludes = this.excludes;
json.config = this.config;
json.extensionMap = this.extensionMap;
result.push(json);
return result;
}
LiteGroup.prototype.initialize = function(){
this.initialize = Function.prototype;
var parentConfig = this.parentConfig
if(parentConfig){
var config = {};
copy(parentConfig.config,config);
copy(this.config,config);
this.config=config;
this.extensionMap = margeExtensionMap(parentConfig.extensionMap,this.extensionMap);
}
this.includes = compilePatterns(this.includes)
this.excludes = compilePatterns(this.excludes)
mergeContentType(this,parentConfig);
this.config["encoding"] = this.encoding;
this.config["contentType"] = this.contentType;
if(this.layout != null){
if(!this.layout || this.layout.charAt() == '/'){
this.config["layout"] = this.layout;
}else{
console.error("layout 必须为绝对地址('/'开始),你的设置为："+this.layout);
}
}
}
function mergeContentType(thiz,parentConfig){
var type=thiz.type;
var encoding = thiz.encoding;
var contentType = thiz.contentType;

if(contentType!=null){
console.info("contentType 用于同时指定 type 和charset 属性，如此需求更推荐您采用type和encoding代替")
var p = contentType.indexOf('charset=');
if(p>0){
var charset = contentType.substring(p+8);
if(encoding){
if(charset.toUpperCase() != encoding.toUpperCase()){
console.info('encoding 与 contentType 不一致'+encoding+','+contentType
+"; ");
}
}else{
encoding = charset;
}
}
var contentType0 = contentType.replace(/\s*;.*$/,'');
if(type){
if(type.toUpperCase() != contentType0.toUpperCase()){
console.error('type 与 contentType 不一致'+type+','+contentType0
+';type 设置将被忽略');
}
}
type = contentType0
}

if(encoding == null){
encoding = parentConfig && parentConfig.encoding || 'UTF-8';
}
if(type == null){
type = parentConfig && parentConfig.type;
}
if(contentType == null){
if(type){
contentType = type+";charset="+encoding;
}
}else{
var p = contentType.indexOf('charset=');
if(p<0){
contentType +=";charset="+encoding;
}
}
thiz.type = type;
thiz.encoding = encoding;
thiz.contentType = contentType;
}
function copy(source,dest){
for(var n in source){
dest[n] = source[n];
}
}
function margeExtensionMap(parentExtMap,thisExtMap){
var result = {};
for(var n in thisExtMap){
result[n] = [].concat(thisExtMap[n]);
}
for(var n in parentExtMap){
var list = [].concat(parentExtMap[n]);
var thisExt = result[n] ;
if(thisExt){
var i = thisExt.length;
while(i--){
appendAfter(list,thisExt[i]);
}
}
result[n] = list;
}
return result;
}
function appendAfter(ps,p){
var i = ps.length;
while(i--){
if(ps[i] == p){
ps.splice(i,1)
}
}
ps.push(p);
}
function compilePatterns(ps){
var i = ps.length;
while(i--){
ps[i] = buildURIMatcher(ps[i]);
}
return ps.join('|')||null;
}
if(typeof require == 'function'){
exports.parseConfig=parseConfig;
var buildURIMatcher = require(7).buildURIMatcher
var loadLiteXML = require(8).loadLiteXML;
var findXMLAttribute=require(8).findXMLAttribute;
}
}
,
function(exports,require){if(typeof require == 'function'){
var Expression=require(17).Expression;
}
function OptimizeScope(code,params){
this.code = code;

this.params = params?params.concat():[];

this.vars = [];

this.calls = [];

this.refs = [];

this.externalRefs = [];

this.fors = [];

this.defs = [];
this.defMap = {};
this.paramMap = listMap(this.params,{});
this.varMap = {}
this._forStack = [];
vistLite(this,this.code = code);
delete this._forStack;
this.callMap =listMap(this.calls, {});
this.refMap =listMap(this.refs, {});
this.externalRefMap =listMap(this.externalRefs, {});
}
function listMap(list,map){
var i = list.length;
while(i--){
var n = list[i];
if(n in map){
map[n]+=1;
}else{
map[n] = 1;
}
}
return map;
}
function ForStatus(code){
this.code = code;
this.index;
this.lastIndex;
this.ref;
this.depth

}
function vistDef(context,item){
var config = item[2];
var params = config.params;
var defaults = config.defaults;

var def = item[-1]||new OptimizeScope(item[1],params);
def.name = config.name;
def.defaults = config.defaults;
context.fors = context.fors.concat(def.fors)
context.defs.push(def.name);
context.defMap[def.name] = def;
def.defs = context.defs;
def.defMap = context.defMap;
}
function vistLite(context,code){
if(code == null){
return null;
}
for(var i=0;i<code.length;i++){
var item = code[i];
if(item instanceof Array){
var type = item[0];

switch (type) {
case VAR_TYPE:
case EL_TYPE:
case XA_TYPE:
case XT_TYPE:
walkEL(context, item[1]);
break;
case IF_TYPE:
case ELSE_TYPE:
case FOR_TYPE:
walkEL(context, item[2]);
break;




}

switch (type) {
case PLUGIN_TYPE:
var className = item[2]['class'];
if(className == 'org.xidea.lite.DefinePlugin'){
vistDef(context,item);
}else if(className == 'org.xidea.lite.parse.ClientPlugin'){

}else if(className == 'org.xidea.lite.EncodePlugin' 
||className =='org.xidea.lite.DatePlugin'
||className =='org.xidea.lite.ModulePlugin'){
vistLite(context,item[1]);
}else{
console.info('unknow plugin',item[2])
}
break;
case CAPTURE_TYPE:
case IF_TYPE:
case ELSE_TYPE:
vistLite(context,item[1]);
break;
case FOR_TYPE:
enterFor(context,item);
addVar(context,item[3]);
vistLite(context,item[1]);
exitFor(context);
break;




}

switch(type){
case CAPTURE_TYPE:
case VAR_TYPE:
addVar(context,item[2]);
addVar(context,item[2]);
}
}
}
}
function enterFor(context,forCode){
var fs = new ForStatus(forCode);
fs.depth = context._forStack.length;
context.fors.push(fs)
context._forStack.push(fs)
}
function exitFor(context){
context._forStack.pop()
}
function addVar(context,n){
context.vars.push(n);
var map = context.varMap;
if(n in map){
map[n]+=1;
}else{
map[n] = 1;
}
}

function walkEL(thiz,el){
if(el == null){
return;
}
var varMap = new Expression(el).getVarMap();

for(var varName in varMap){
var list = varMap[varName];
var len = list.length;
if(varName == 'for'){

for(var i =0;i<len;i++){
var p = list[i];
if(p == ''){
setForStatus(thiz,'*');
}else if(p == 'index' || p == 'lastIndex'){
setForStatus(thiz,p);
}else{
console.error('for 不能有index，lastIndex 之外的其他属性');
setForStatus(thiz,'*');
}
}
}else{
if(!(varName in thiz.varMap || varName in thiz.paramMap)){
thiz.externalRefs.push(varName);
}
thiz.refs.push(varName);
}
}
var callMap = new Expression(el).getCallMap();
for(var callName in callMap){
var list = callMap[callName];
var len = list.length;
for(var i =0;i<len;i++){
if(varName in thiz.varMap 

|| varName in thiz.paramMap
){
thiz.calls.push('*');
}else if(varName){
thiz.calls.push(varName);
}
}
}
}
function setForStatus(thiz,attrName){
var fs = thiz._forStack[thiz._forStack.length-1];
if(fs){
if(attrName == 'index'){fs.index =true;}
else if(attrName == 'lastIndex'){fs.lastIndex =true;}
else if(attrName == '*'){fs.ref = true;}
else{throw new Error("for不支持属性:"+attrName);}
}else{
throw new Error("for 变量不能在循环外使用:for."+attrName);
}
}















if(typeof require == 'function'){
exports.OptimizeScope=OptimizeScope;
var VAR_TYPE=require(14).VAR_TYPE;
var XA_TYPE=require(14).XA_TYPE;
var ELSE_TYPE=require(14).ELSE_TYPE;
var PLUGIN_TYPE=require(14).PLUGIN_TYPE;
var CAPTURE_TYPE=require(14).CAPTURE_TYPE;
var IF_TYPE=require(14).IF_TYPE;
var EL_TYPE=require(14).EL_TYPE;
var BREAK_TYPE=require(14).BREAK_TYPE;
var XT_TYPE=require(14).XT_TYPE;
var FOR_TYPE=require(14).FOR_TYPE;
}
}
,
function(exports,require){

var ID_PATTERN_QUTE = /^"[a-zA-Z_\$][_\$\w]*"$/;
var NUMBER_CALL = /^(\d+)(\.\w+)$/;
var PRESERVED = /^(break|case|catch|continue|default|delete|do|else|finally|for|function|if|in|instanceof|new|return|switch|throw|try|typeof|var|void|while|with|class|const|debugger|enum|export|extends|import|super)$/
var defaultContext = {
getForName:String,
findForAttribute:function(varName,propertyName){},
genGetCode:function(owner,property){
if(ID_PATTERN_QUTE.test(property)){
return owner+'.'+property.slice(1,-1);
}else{
return owner+'['+property+']';
}
}
}

function stringifyJSEL(el,context){
var type = el[0];
if(type<=0){
return stringifyValue(el,context)
}else if(getTokenParamIndex(type) ==3){
return stringifyInfix(el,context);
}else{
return stringifyPrefix(el,context);
}
}

function stringifyValue(el,context){
var param = el[1];
switch(el[0]){
case VALUE_CONSTANTS:
return (param && param['class']=='RegExp' && param.literal) || JSON.stringify(param);
case VALUE_VAR:

if(param == 'for'){
var f = context.getForName();
if(f){
param = f;
}


}else{
}
return context.getVarName(param) ;
case VALUE_LIST:
return "[]";
case VALUE_MAP:
return "{}";
}
}
function stringifyGetter(context,el){
var el1 = el[1];
var el2 = el[2];
if(el2[0] == VALUE_CONSTANTS && el1[0] == VALUE_VAR){
var varName = getTokenParam(el1)
var propertyName = getTokenParam(el2)
if(typeof propertyName == 'string'){
var forAttr = context.findForAttribute(varName,propertyName);
if(forAttr){
return forAttr;
}
}
}
var value1 = stringifyJSEL(el1,context);
var value2 = stringifyJSEL(el2,context);



value1 = addELQute(el,el1,value1)
return context.genGetCode(value1,value2);
}
function stringifyPropertyCall(context,propertyEL,callArguments){
var value1 = stringifyGetter(context,propertyEL);
var value2 = stringifyJSEL(callArguments,context);
if(value1.match(/\)$/)){

return value1.slice(0,-1)+','+value2+')'
}else{
value1 = value1.replace(NUMBER_CALL,'($1)$2')
return value1+"("+value2.slice(1,-1)+')';
}
}

function stringifyInfix(el,context){
var type = el[0];
var el1 = el[1];
var el2 = el[2];
if(type == OP_GET){
return stringifyGetter(context,el);
}else if(type == OP_INVOKE && el1[0] == OP_GET){
return stringifyPropertyCall(context,el1,el2);
}
var opc = findTokenText(el[0]);
var value1 = stringifyJSEL(el1,context);
var value2 = stringifyJSEL(el2,context);

switch(type){
case OP_INVOKE:
value2 = value2.slice(1,-1);
value1 = value1.replace(NUMBER_CALL,'($1)$2')
return value1+"("+value2+')';

case OP_JOIN:
if("[]"==value1){
return "["+value2+"]"
}else{
return value1.slice(0,-1)+','+value2+"]"
}
case OP_PUT:
value2 = JSON.stringify(getTokenParam(el))+":"+value2+"}";
if("{}"==value1){
return "{"+value2
}else{
return value1.slice(0,-1)+','+value2
}
case OP_QUESTION:





return null;
case OP_QUESTION_SELECT:


var test = stringifyJSEL(el1[1],context);
var value1 = stringifyJSEL(el1[2],context);
return test+'?'+value1+":"+value2;
}
value1 = addELQute(el,el1,value1)
value2 = addELQute(el,el2,null,value2)
return value1 + opc + value2;
}

function stringifyPrefix(el,context){
var type = el[0];
var el1 = el[1];
var value = stringifyJSEL(el1,context);
var param = getTokenParam(el);
value = addELQute(el,el1,null,value)
var opc = findTokenText(type);
return opc+value;
}
if(typeof require == 'function'){
exports.stringifyJSEL=stringifyJSEL;
var getTokenParam=require(33).getTokenParam;
var getTokenParamIndex=require(33).getTokenParamIndex;
var findTokenText=require(33).findTokenText;
var addELQute=require(33).addELQute;
var OP_GET=require(33).OP_GET;
var OP_IN=require(33).OP_IN;
var OP_INVOKE=require(33).OP_INVOKE;
var OP_JOIN=require(33).OP_JOIN;
var OP_PUT=require(33).OP_PUT;
var OP_QUESTION=require(33).OP_QUESTION;
var OP_QUESTION_SELECT=require(33).OP_QUESTION_SELECT;
var VALUE_CONSTANTS=require(33).VALUE_CONSTANTS;
var VALUE_LIST=require(33).VALUE_LIST;
var VALUE_MAP=require(33).VALUE_MAP;
var VALUE_VAR=require(33).VALUE_VAR;
}
}
,
function(exports,require){if(typeof require == 'function'){
var JSONTokenizer=require(41).JSONTokenizer;
}

var BRACKET_BEGIN = 0xFFFE;
var BRACKET_END = 0xFFFF;
var STATUS_BEGIN = -100;
var STATUS_EXPRESSION = -101;
var STATUS_OPERATOR = -102;
var fns = {
getResult :function() {
return this.expression;

},
parseEL :function() {
this.skipSpace(0);
while (this.start < this.end) {
var c = this.value.charAt(this.start);
if (c == '"' || c == '\'') {
var text = this.findString();
this.addKeyOrObject(text, false);
} else if (c >= '0' && c <= '9') {
var number = this.findNumber();
this.addKeyOrObject(number, false);
} else if (/[\w$_]/.test(c)) {
var id = this.findId();
switch(id){
case 'true':
this.addToken([VALUE_CONSTANTS,true]);
break;
case 'false':
this.addToken([VALUE_CONSTANTS,false]);
break;
case 'null':
this.addToken([VALUE_CONSTANTS,null]);
break;



default:
this.skipSpace(0);
if (this.previousType == OP_GET) {
this.addToken([VALUE_CONSTANTS,
id]);
} else {
this.addKeyOrObject(id, true);
}
}
} else {
var op = this.findOperator();

if( c=='.' && /\d/.test(this.value.charAt(this.start))){
var number = this.value.substr(this.start-1).match(/^\.\d+/)[0];
this.start+=number.length-1;
this.addKeyOrObject(1*number, false);
}else{

this.parseOperator(op);
if (op == null) {
this.parseError("未知操作符:");
}
}
}
this.skipSpace(0);
}
},
parseError:function(msg){
msg = msg+"\n@"+ this.start + "\n"
+ this.value.substring(this.start)+"\n----\n"+this.value
console.error(msg);
throw new Error(msg);
},
findOperator :function() {
var c = this.value.charAt(this.start);
var end = this.start+1;
var next = this.value.charAt(end);
switch (c) {
case ',':
case ':':
case '[':
case ']':
case '{':
case '}':
case '(':
case ')':
case '.':
case '?':
case '~':
case '^':
break;
case '+':
case '-':
case '*':
case '/':
case '%':
if(next == '=' ){
this.parseError("不支持赋值操作:");
}else if(next == c){
this.parseError("不支持自增自减操作:");
}
break;
case '=':
if(next == '='){
end++;
if(this.value.charAt(end) == '='){
end++;
}
}else{
this.parseError("不支持赋值操作:");
}
break;
case '!':
if(next == '='){
end++;
if(this.value.charAt(end) == '='){
end++;
}
}
break;
case '>':
case '<':
if (next == '=') {
end++;
}else if(next == c){
if(this.value.charAt(end) == c){
end++;
}
}
break;
case '&':
case '|':
if( (c == next)){
end++;
}
break;
default:
return null;
}
return this.value.substring(this.start, this.start = end);
},

isMapMethod :function() {
var i = this.tokens.length - 1;
var depth = 0;
for (; i >= 0; i--) {
var token = this.tokens[i];
var type = token[0];
if (depth == 0) {
if (type == OP_PUT
|| type == VALUE_MAP) {


return true;
} else if (type == OP_JOIN) {


return false;
}
}
if (type == BRACKET_BEGIN) {
depth--;
} else if (type == BRACKET_END) {
depth++;
}
}
return false;
},
parseOperator :function(op) {
if (op.length == 1) {
switch (op.charAt(0)) {
case '(':
if (this.status == STATUS_EXPRESSION) {
this.addToken([OP_INVOKE]);
if (this.skipSpace(')')) {
this.addToken([VALUE_CONSTANTS,
[]]);
this.start++;
} else {
this.addList();
}
} else {
this.addToken([BRACKET_BEGIN]);
}
break;
case '[':
if (this.status == STATUS_EXPRESSION) {
this.addToken([OP_GET]);
this.addToken([BRACKET_BEGIN]);
}else {
this.addList();
}
break;
case '{':
this.addMap();
break;
case '}':
case ']':
case ')':
this.addToken([BRACKET_END]);
break;
case '+':
this.addToken([
this.status == STATUS_EXPRESSION ? OP_ADD : OP_POS]);
break;
case '-':
this.addToken([
this.status == STATUS_EXPRESSION ? OP_SUB
: OP_NEG]);
break;
case ':':
this.addToken([OP_QUESTION_SELECT]);
break;
case ',':

if (this.isMapMethod()) {
this.status = STATUS_OPERATOR;
}else{
this.addToken([OP_JOIN]);
}
break;
case '/':
var next = this.value.charAt(this.start);
if (next == '/') {
var end1 = this.value.indexOf('\n', this.start);
var end2 = this.value.indexOf('\r', this.start);
var cend = Math.min(end1, end2);
if (cend < 0) {
cend = Math.max(end1, end2);
}
if (cend > 0) {
this.start = cend;
} else {
this.start = this.end;
}
break;
} else if (next == '*') {
var cend = this.value.indexOf("*/", this.start);
if (cend > 0) {
this.start = cend + 2;
} else {
throw new Error("未結束注釋:" + this.value
+ "@" + this.start);
}
break;
}else if(this.status != STATUS_EXPRESSION){
var end = findRegExp(this.value,this.start);
if(end>0){
this.addToken([VALUE_CONSTANTS,
toValue(
this.value.substring(this.start-1,end))]);
this.start = end;
break;
}else{
throw new Error("异常正则:"+this.value+'@'+this.start)
}


}
default:
this.addToken([findTokenType(op)]);
}
} else {
this.addToken([findTokenType(op)]);
}
},
addToken :function(token) {
var type= token[0];
if(type == VALUE_VAR){
if("in" == token[1]){
token[0] = type = OP_IN;
}
}
switch (type) {
case BRACKET_BEGIN:
this.status = STATUS_BEGIN;
break;
case VALUE_CONSTANTS:
case VALUE_VAR:
case BRACKET_END:
this.status = STATUS_EXPRESSION;
break;
default:
this.status = STATUS_OPERATOR;
break;
}

this.previousType = type;
this.tokens.push(token);
},
addKeyOrObject :function(object, isVar) {
if (this.skipSpace(':') && this.isMapMethod()) {
this.addToken([OP_PUT, object]);
this.start++;
} else if (isVar) {
this.addToken([VALUE_VAR, object]);
} else {
this.addToken([VALUE_CONSTANTS, object]);
}
},
addList :function() {
this.addToken([BRACKET_BEGIN]);
this.addToken([VALUE_LIST]);
if (!this.skipSpace(']')) {
this.addToken([OP_JOIN]);
}
},
addMap :function() {
this.addToken([BRACKET_BEGIN]);
this.addToken([VALUE_MAP]);
}
};
var pt = new JSONTokenizer('');
for(var n in fns){
pt[n] = fns[n]
}
function toValue(s){
var v= this.eval(s);
if(v instanceof RegExp){
v = {
"class":"RegExp",
'literal':s+''
}
}
return v;
}
function findRegExp(text,start){
var depth=0,c;
while(c = text.charAt(start++)){
if(c=='['){
depth = 1;
}else if(c==']'){
depth = 0;
}else if (c == '\\') {
start++;
}else if(depth == 0 && c == '/'){
while(c = text.charAt(start++)){
switch(c){
case 'g':
case 'i':
case 'm':
break;
default:
return start-1;
}
}
}
}
}

function ExpressionTokenizer(value){
this.value = value.replace(/^\s+|\s+$/g,'');
this.start = 0;
this.end = this.value.length;
this.status = STATUS_BEGIN;
this.previousType = STATUS_BEGIN;
this.tokens = [];
this.parseEL();
prepareSelect(this.tokens)
this.expression = buildTree(trimToken(right(this.tokens)));
}
function prepareSelect(tokens) {
var p1 = tokens.length;
while (p1--) {
var type1 = tokens[p1][0];
if (type1 == OP_QUESTION) { 
var pos = getSelectRange(tokens,p1, -1, -1);
tokens.splice(pos+1,0, [BRACKET_BEGIN]);
p1++;
} else if (type1 == OP_QUESTION_SELECT) {
var end = tokens.length;
var pos = getSelectRange(tokens,p1, 1, end);
tokens.splice(pos,0, [BRACKET_END]);
}
}
}
function getSelectRange(tokens,p2, inc, end) {
var dep = 0;
while ((p2 += inc) != end) {
var type2 = tokens[p2][0];
if (type2 > 0) {
if (type2 == BRACKET_BEGIN) {
dep += inc;
} else if (type2 == BRACKET_END) {
dep -= inc;
} else if (dep == 0 && getPriority(type2) <= getPriority(OP_QUESTION)) {
return p2;
}
if (dep < 0) {
return p2;
}
}
}
return inc > 0 ? end : -1;
}
function buildTree(tokens){
var stack = [];
for(var i=0;i<tokens.length;i++){
var item = tokens[i]
var type = item[0];
switch(type){
case VALUE_CONSTANTS:
case VALUE_VAR:
case VALUE_LIST:
case VALUE_MAP:
stack.push(item);
break;
default:
if(getTokenParamIndex(type) ==3){
var arg2 = stack.pop();
var arg1 = stack.pop();
var el = [type,arg1,arg2]
}else{
var arg1 = stack.pop();
var el = [type,arg1]
}
if(hasTokenParam(type)){
el[getTokenParamIndex(type)] = item[1];
}
stack.push(el)
}
}
return stack[0];
}
ExpressionTokenizer.prototype = pt;

function right(tokens) {
var rightStack = [[]];
var buffer = [];
for (var i = 0;i<tokens.length;i++) {
var item = tokens[i];
if (item[0] > 0) {
if (buffer.length == 0) {
buffer.push(item);
} else if (item[0] == BRACKET_BEGIN) {
buffer.push(item);
} else if (item[0] == BRACKET_END) {
while (true) {
var operator = buffer.pop();
if (operator[0] == BRACKET_BEGIN) {
break;
}
addRightToken(rightStack, operator);
}
} else {
while (buffer.length!=0
&& rightEnd(item[0], buffer[buffer.length-1][0])) {
var operator = buffer.pop();


addRightToken(rightStack, operator);
}
buffer.push(item);
}
} else {
addRightToken(rightStack, item);
}
}
while (buffer.length !=0) {
var operator = buffer.pop();
addRightToken(rightStack, operator);
}
return rightStack[rightStack.length-1];
}
function trimToken(tokens){
for(var i=0;i<tokens.length;i++){
var token = tokens[i];
token.length = getTokenLength(token[0]);
}
return tokens;
}
function addRightToken(rightStack,
token) {
var list = rightStack[rightStack.length-1];










list.push(token);
}
function getPriority(type) {
switch (type) {
case BRACKET_BEGIN:
case BRACKET_END:
return Math.MIN_VALUE;
default:
return (type & BIT_PRIORITY)<<4 | (type & BIT_PRIORITY_SUB)>>8;
}
}

function rightEnd(currentType, priviousType) {
var priviousPriority = getPriority(priviousType);
var currentPriority = getPriority(currentType);
return currentPriority <= priviousPriority;
}
if(typeof require == 'function'){
exports.getPriority=getPriority;
exports.ExpressionTokenizer=ExpressionTokenizer;
var hasTokenParam=require(33).hasTokenParam;
var getTokenParam=require(33).getTokenParam;
var hasTokenParam=require(33).hasTokenParam;
var getTokenParamIndex=require(33).getTokenParamIndex;
var getTokenLength=require(33).getTokenLength;
var findTokenType=require(33).findTokenType;
var BIT_PRIORITY=require(33).BIT_PRIORITY;
var BIT_PRIORITY_SUB=require(33).BIT_PRIORITY_SUB;
var OP_ADD=require(33).OP_ADD;
var OP_GET=require(33).OP_GET;
var OP_IN=require(33).OP_IN;
var OP_INVOKE=require(33).OP_INVOKE;
var OP_JOIN=require(33).OP_JOIN;
var OP_NE=require(33).OP_NE;
var OP_NEG=require(33).OP_NEG;
var OP_POS=require(33).OP_POS;
var OP_PUT=require(33).OP_PUT;
var OP_QUESTION=require(33).OP_QUESTION;
var OP_QUESTION_SELECT=require(33).OP_QUESTION_SELECT;
var OP_SUB=require(33).OP_SUB;
var VALUE_CONSTANTS=require(33).VALUE_CONSTANTS;
var VALUE_LIST=require(33).VALUE_LIST;
var VALUE_MAP=require(33).VALUE_MAP;
var VALUE_VAR=require(33).VALUE_VAR;
}
}
,
function(exports,require){
var BIT_PRIORITY= 60;
var BIT_PRIORITY_SUB= 3840;
var BIT_ARGS= 192;
var POS_INC= 12;
var VALUE_CONSTANTS= -1;
var VALUE_VAR= -2;
var VALUE_LIST= -3;
var VALUE_MAP= -4;
var OP_GET= 96;
var OP_INVOKE= 97;
var OP_NOT= 28;
var OP_BIT_NOT= 29;
var OP_POS= 30;
var OP_NEG= 31;
var OP_MUL= 88;
var OP_DIV= 89;
var OP_MOD= 90;
var OP_ADD= 84;
var OP_SUB= 85;
var OP_LSH= 80;
var OP_RSH= 81;
var OP_URSH= 82;
var OP_LT= 332;
var OP_GT= 333;
var OP_LTEQ= 334;
var OP_GTEQ= 335;
var OP_IN= 4428;
var OP_EQ= 76;
var OP_NE= 77;
var OP_EQ_STRICT= 78;
var OP_NE_STRICT= 79;
var OP_BIT_AND= 1096;
var OP_BIT_XOR= 840;
var OP_BIT_OR= 584;
var OP_AND= 328;
var OP_OR= 72;
var OP_QUESTION= 68;
var OP_QUESTION_SELECT= 69;
var OP_JOIN= 64;
var OP_PUT= 65;
var TYPE_TOKEN_MAP = {}
var TOKEN_TYPE_MAP = {}
function addToken(type,token){
TYPE_TOKEN_MAP[type] = token;
TOKEN_TYPE_MAP[token] = type;
}
addToken(VALUE_CONSTANTS ,"value");
addToken(VALUE_VAR ,"var");
addToken(VALUE_LIST ,"[]");
addToken(VALUE_MAP ,"{}");

addToken(OP_GET ,".");
addToken(OP_INVOKE ,"()");

addToken(OP_NOT ,"!");
addToken(OP_BIT_NOT ,"~");
addToken(OP_POS ,"+");
addToken(OP_NEG ,"-");

addToken(OP_MUL ,"*");
addToken(OP_DIV ,"/");
addToken(OP_MOD ,"%");


addToken(OP_ADD ,"+");
addToken(OP_SUB ,"-");

addToken(OP_LSH ,"<<");
addToken(OP_RSH ,">>");
addToken(OP_URSH ,">>>");

addToken(OP_LT ,"<");
addToken(OP_GT ,">");
addToken(OP_LTEQ ,"<=");
addToken(OP_GTEQ ,">=");
addToken(OP_IN ," in ");

addToken(OP_EQ ,"==");
addToken(OP_NE ,"!=");
addToken(OP_EQ_STRICT ,"===");
addToken(OP_NE_STRICT ,"!==");

addToken(OP_BIT_AND ,"&");
addToken(OP_BIT_XOR ,"^");
addToken(OP_BIT_OR ,"|");

addToken(OP_AND ,"&&");
addToken(OP_OR ,"||");


addToken(OP_QUESTION ,"?");

addToken(OP_QUESTION_SELECT ,":");


addToken(OP_JOIN ,",");

addToken(OP_PUT ,":");
function findTokenType(token) {
return TOKEN_TYPE_MAP[token];
}
function findTokenText(type) {
return TYPE_TOKEN_MAP[type];
}
function hasTokenParam(type) {
switch (type) {
case VALUE_VAR:
case VALUE_CONSTANTS:



case OP_PUT:
return true;
default:
return false;
}
}
function getTokenParam(el) {
return el[getTokenParamIndex(el[0])]
}
function getTokenLength(type) {
var size = getTokenParamIndex(type);
return hasTokenParam(type)?size+1:size;
}




































function getTokenParamIndex(type) {
if(type<0){
return 1;
}
var c = (type & BIT_ARGS) >> 6;
return c + 2;
}
var offset = 0
var TYPE_NULL = 1<<offset++;
var TYPE_BOOLEAN = 1<<offset++;
var TYPE_NUMBER = 1<<offset++;
var TYPE_STRING = 1<<offset++;
var TYPE_ARRAY = 1<<offset++;
var TYPE_MAP = 1<<offset++;
var TYPE_ANY = (1<<offset++) -1;







function isNTSFAN(type){
var isN = (type & TYPE_NULL) ||(type & TYPE_BOOLEAN) ||(type & TYPE_NUMBER);
var isS = (type & TYPE_STRING) ||(type & TYPE_ARRAY) ||(type & TYPE_MAP);
if(!isS ){
return true;
}
if(!isN ){
return false;
}
return null;
}
function getAddType(arg1,arg2){
var t1 = getELType(arg1);
var t2 = getELType(arg2);
var ns1 = isNTSFAN(t1);
var ns2 = isNTSFAN(t2);

if(ns1 === false || ns2 === false){
return TYPE_STRING;
}
if(ns1 === true && ns2 === true){
return TYPE_NUMBER;
}
return TYPE_NUMBER|TYPE_STRING;
}
function getELType(el){
var op = el[0];
var type;
if(op>0){
var arg1 = el[1];
var arg2 = el[2];
switch(op){
case OP_JOIN:
return TYPE_ARRAY;
case OP_PUT:
return TYPE_MAP;
case OP_ADD:



return getAddType(arg1,arg2)

case OP_POS:
case OP_NEG:
case OP_MUL:
case OP_DIV:
case OP_MOD:
case OP_SUB:
case OP_BIT_AND:
case OP_BIT_XOR:
case OP_BIT_OR:
case OP_BIT_NOT:
return TYPE_NUMBER;
case OP_NOT:
case OP_LT:
case OP_GT:
case OP_LTEQ:
case OP_GTEQ:
case OP_EQ:
case OP_NE:
case OP_EQ_STRICT:
case OP_NE_STRICT:
return TYPE_BOOLEAN;
case OP_AND:
case OP_OR:
return getELType(arg1) | getELType(arg2);
case OP_GET:
if(arg2[0] == VALUE_CONSTANTS){
if(arg1[0] == VALUE_VAR && arg1[1] == 'for'){
if(arg2[1] == 'index' || arg2[1] == 'lastIndex'){
return TYPE_NUMBER;
}
}else if( arg2[1] == 'length'){
var t1 = getELType(arg1);






if(t1 & TYPE_MAP){
return TYPE_ANY;
}else if((t1 & TYPE_ARRAY) || (t1 & TYPE_STRING)){
if((t1 & TYPE_STRING) || (t1 & TYPE_BOOLEAN)||(t1 & TYPE_NUMBER)){
return TYPE_NULL|TYPE_NUMBER;
}else{
return TYPE_NUMBER;
}
}else{
return TYPE_NULL;
}
}
}
return TYPE_ANY;
case OP_INVOKE:
if(arg1[0] == VALUE_VAR){
switch(arg1[1]){
case "encodeURI":
case "encodeURIComponent":
case "decodeURI":
case "decodeURIComponent":
return TYPE_STRING;
case "parseInt":
case "parseInt":
return TYPE_NUMBER;
case "isFinite":
case "isNaN":
return TYPE_BOOLEAN;
}
}else if(arg1[0] == OP_GET){

arg2 = arg1[2];
arg1 = arg1[1];
if(arg2[0] == VALUE_CONSTANTS){
var method = arg2[1];
if(arg1[0] == VALUE_VAR){
var owner = arg1[1];
if(owner == 'JSON'){
if(method == 'stringify'){
return TYPE_STRING;
}
}else if(owner == 'Math'){
return TYPE_NUMBER;
}
}
}
}
return TYPE_ANY;
default:
return TYPE_ANY;
}
}else{
switch(op){
case VALUE_CONSTANTS:
var v= el[1];
if(v == null){
return TYPE_NULL;
}
switch(typeof v){
case 'boolean':
return TYPE_BOOLEAN;
case 'number':
return TYPE_NUMBER;
case 'string':
return TYPE_STRING;
case 'object':
if(v instanceof Array){
return TYPE_ARRAY;
}
return TYPE_MAP;
}
return TYPE_ANY;
case VALUE_VAR:
return TYPE_ANY;
case VALUE_LIST:
return TYPE_ARRAY;
case VALUE_MAP:
return TYPE_MAP;
default:
return TYPE_ANY;
}
}
}

function addELQute(parentEl,childEL,value1,value2){
var pp = getPriority(parentEl[0]);
var cp = getPriority(childEL[0]);
if(value1){
if(cp<pp){
value1 = '('+value1+')';
}
return value1;
}else if(value2 && pp>=cp){
value2 = '('+value2+')';
}
return value2;
}
if(typeof require == 'function'){
exports.getTokenParam=getTokenParam;
exports.hasTokenParam=hasTokenParam;
exports.getTokenParamIndex=getTokenParamIndex;
exports.getTokenLength=getTokenLength;
exports.findTokenType=findTokenType;
exports.findTokenText=findTokenText;
exports.getELType=getELType;
exports.addELQute=addELQute;
exports.BIT_ARGS=BIT_ARGS;
exports.BIT_PRIORITY=BIT_PRIORITY;
exports.BIT_PRIORITY_SUB=BIT_PRIORITY_SUB;
exports.OP_ADD=OP_ADD;
exports.OP_AND=OP_AND;
exports.OP_BIT_AND=OP_BIT_AND;
exports.OP_BIT_NOT=OP_BIT_NOT;
exports.OP_BIT_OR=OP_BIT_OR;
exports.OP_BIT_XOR=OP_BIT_XOR;
exports.OP_DIV=OP_DIV;
exports.OP_EQ=OP_EQ;
exports.OP_EQ_STRICT=OP_EQ_STRICT;
exports.OP_GET=OP_GET;
exports.OP_GT=OP_GT;
exports.OP_GTEQ=OP_GTEQ;
exports.OP_IN=OP_IN;
exports.OP_INVOKE=OP_INVOKE;
exports.OP_JOIN=OP_JOIN;
exports.OP_LSH=OP_LSH;
exports.OP_LT=OP_LT;
exports.OP_LTEQ=OP_LTEQ;
exports.OP_MOD=OP_MOD;
exports.OP_MUL=OP_MUL;
exports.OP_NE=OP_NE;
exports.OP_NEG=OP_NEG;
exports.OP_NE_STRICT=OP_NE_STRICT;
exports.OP_NOT=OP_NOT;
exports.OP_OR=OP_OR;
exports.OP_POS=OP_POS;
exports.OP_PUT=OP_PUT;
exports.OP_QUESTION=OP_QUESTION;
exports.OP_QUESTION_SELECT=OP_QUESTION_SELECT;
exports.OP_RSH=OP_RSH;
exports.OP_SUB=OP_SUB;
exports.OP_URSH=OP_URSH;
exports.TYPE_ANY=TYPE_ANY;
exports.TYPE_ARRAY=TYPE_ARRAY;
exports.TYPE_BOOLEAN=TYPE_BOOLEAN;
exports.TYPE_MAP=TYPE_MAP;
exports.TYPE_NULL=TYPE_NULL;
exports.TYPE_NUMBER=TYPE_NUMBER;
exports.TYPE_STRING=TYPE_STRING;
exports.TYPE_TOKEN_MAP=TYPE_TOKEN_MAP;
exports.VALUE_CONSTANTS=VALUE_CONSTANTS;
exports.VALUE_LIST=VALUE_LIST;
exports.VALUE_MAP=VALUE_MAP;
exports.VALUE_VAR=VALUE_VAR;
var evaluate=require(34).evaluate;
var getPriority=require(32).getPriority;
}
}
,
function(exports,require){

function Expression(value){
if(typeof value == 'string'){
value = new ExpressionTokenizer(value).getResult();
}else if(value instanceof Expression){
return value;
}
this.token = value;
}
Expression.prototype.evaluate = function(context){
return evaluate(context,this.token);
}

Expression.prototype.getVarMap = function(){
init(this);
return this.varMap;
}

Expression.prototype.getCallMap = function(){
init(this);
return this.callMap;
}
function init(thiz){
if(thiz.callMap == null){
thiz.callMap = {};
thiz.varMap = {};
walkEL(thiz.token,thiz);
}
}
function walkEL(token,context){
var op = token[0];
if(op<=0){
if(op == VALUE_VAR){
_addKeyList(context.varMap,token[1],'');
}
return;
}else{
var arg1 = token[1];
if(op == OP_INVOKE){
if(arg1[0] == VALUE_VAR){
_addKeyList(context.callMap,arg1[1],'');
}else if(arg1[0] == OP_GET){
var list = walkMembers(arg1,context,[]).reverse();
var ps = list.slice(1).join('.');
if(list[0] != ''){
if(list[0] != '*' ){
_addKeyList(context.varMap,list[0],ps);
}
_addKeyList(context.callMap,list[0],ps);
}
}else{
walkEL(arg1,context);
_addKeyList(context.callMap,"*",'');
}
}else{
if(op == OP_GET){
var list = walkMembers(token,context,[]).reverse();
var ps = list.slice(1).join('.');
if(list[0] != ''){
if(list[0] != '*' ){
_addKeyList(context.varMap,list[0],ps);
}
}
}else{
arg1 && walkEL(arg1,context);
}
}
var pos = getTokenParamIndex(token[0]);
if(pos>2){
walkEL(token[2],context);
}
}
}
function walkMembers(token,context,buf){
var owner = token[1];
var key = token[2];
if(key[0] == VALUE_CONSTANTS){
buf.push(key[1]);
}else{
walkEL(key,context);
buf.push('*');
}
if(owner[0] == VALUE_VAR){
buf.push(owner[1]);
}else if(owner[0] == VALUE_CONSTANTS){
buf.push('');
}else if(owner[0] == OP_GET){
walkMembers(owner,context,buf);
}else{
walkEL(owner,context);
buf.push('*');
}
return buf;
}
function _addKeyList(map,key,value){
var list = key in map? map[key]: (map[key] = []);
if(list.indexOf(value) <0){
list.push(value);
}
return list;
}
Expression.prototype.toString = function(context){
return stringifyJSEL(this.token,context);

}
Expression.evaluate = evaluate;

function evaluate(context,el){
var result = _evaluate(el,context)
return realValue(result);
}
function _evaluate(item,context){
var type = item[0];
switch(type){
case VALUE_LIST:
return [];
case VALUE_MAP:
return {};
case VALUE_VAR:
arg1 = item[1]
return (arg1 in context?context:this)[arg1];
case VALUE_CONSTANTS:
arg1 = item[1];
return arg1&&arg1['class'] == 'RegExp'?window.eval(arg1.literal):arg1;

case OP_AND:
return realValue(_evaluate(item[1],context)) && (_evaluate(item[2],context));
case OP_OR:
return realValue(_evaluate(item[1],context)) || (_evaluate(item[2],context));
case OP_QUESTION:
if(realValue(_evaluate(item[1],context))){
return _evaluate(item[2],context);
}else{
return PropertyValue;
}
case OP_QUESTION_SELECT:
arg1 = realValue(_evaluate(item[1],context));
if(arg1 == PropertyValue){
return _evaluate(item[2],context);
}else{
return arg1;
}
}
var arg1=_evaluate(item[1],context);
if(getTokenParamIndex(type) ==3){
var arg2=realValue(_evaluate(item[2],context));
}
if(type == OP_INVOKE){
if(typeof arg1 == 'function'){
return arg1.apply(context,arg2);
}else if(arg1 instanceof PropertyValue){
var thiz = arg1[0];
var key = arg1[1];
var fn = thiz[key];

if(fn == String.prototype.replace || fn == String.prototype.match){
arg2 = arg2.slice(0);
var exp = arg2[0];
if(exp && exp['class'] == 'RegExp'){
arg2[0] = window.eval(exp.source)
}
}
return fn.apply(thiz,arg2);
}else{
throw new Error("not a fn!!"+arg1)
}
}
arg1 = realValue(arg1);
switch(type){



case OP_GET:
return new PropertyValue(arg1,arg2);
case OP_NOT:
return !arg1;
case OP_POS:
return +arg1;
case OP_NEG:
return -arg1;

case OP_ADD:
return arg1+arg2;
case OP_SUB:
return arg1-arg2;
case OP_MUL:
return arg1*arg2;
case OP_DIV:
return arg1/arg2;
case OP_MOD:
return arg1%arg2;

case OP_GT:
return arg1 > arg2;
case OP_GTEQ:
return arg1 >= arg2;
case OP_NE:
return arg1 != arg2;
case OP_NE_STRICT:
return arg1 !== arg2;
case OP_EQ:
return arg1 == arg2;
case OP_EQ_STRICT:
return arg1 === arg2;
case OP_LT:
return arg1 < arg2;
case OP_LTEQ:
return arg1 <= arg2;
case OP_IN:
return arg1 in arg2;
case OP_JOIN:
arg1.push(arg2)
return arg1;
case OP_PUT:
arg1[getTokenParam(item)]= arg2;
return arg1;
}
}
function PropertyValue(base,name){
this[0] = base;
this[1] = name;
}
function realValue(arg1){
if(arg1 instanceof PropertyValue){
return arg1[0][arg1[1]];
}
return arg1;
}
if(typeof require == 'function'){
exports.Expression=Expression;
var stringifyJSEL = require(31).stringifyJSEL
var ExpressionTokenizer=require(32).ExpressionTokenizer;
var getTokenParam=require(33).getTokenParam;
var getTokenParamIndex=require(33).getTokenParamIndex;
var OP_ADD=require(33).OP_ADD;
var OP_AND=require(33).OP_AND;
var OP_DIV=require(33).OP_DIV;
var OP_EQ=require(33).OP_EQ;
var OP_EQ_STRICT=require(33).OP_EQ_STRICT;
var OP_GET=require(33).OP_GET;
var OP_GT=require(33).OP_GT;
var OP_GTEQ=require(33).OP_GTEQ;
var OP_IN=require(33).OP_IN;
var OP_INVOKE=require(33).OP_INVOKE;
var OP_JOIN=require(33).OP_JOIN;
var OP_LT=require(33).OP_LT;
var OP_LTEQ=require(33).OP_LTEQ;
var OP_MOD=require(33).OP_MOD;
var OP_MUL=require(33).OP_MUL;
var OP_NE=require(33).OP_NE;
var OP_NEG=require(33).OP_NEG;
var OP_NE_STRICT=require(33).OP_NE_STRICT;
var OP_NOT=require(33).OP_NOT;
var OP_OR=require(33).OP_OR;
var OP_POS=require(33).OP_POS;
var OP_PUT=require(33).OP_PUT;
var OP_QUESTION=require(33).OP_QUESTION;
var OP_QUESTION_SELECT=require(33).OP_QUESTION_SELECT;
var OP_SUB=require(33).OP_SUB;
var VALUE_CONSTANTS=require(33).VALUE_CONSTANTS;
var VALUE_LIST=require(33).VALUE_LIST;
var VALUE_MAP=require(33).VALUE_MAP;
var VALUE_VAR=require(33).VALUE_VAR;
}
}
,
function(exports,require){if(typeof require == 'function'){
var JSONTokenizer=require(41).JSONTokenizer;
}

var BRACKET_BEGIN = 0xFFFE;
var BRACKET_END = 0xFFFF;
var STATUS_BEGIN = -100;
var STATUS_EXPRESSION = -101;
var STATUS_OPERATOR = -102;
var fns = {
getResult :function() {
return this.expression;

},
parseEL :function() {
this.skipSpace(0);
while (this.start < this.end) {
var c = this.value.charAt(this.start);
if (c == '"' || c == '\'') {
var text = this.findString();
this.addKeyOrObject(text, false);
} else if (c >= '0' && c <= '9') {
var number = this.findNumber();
this.addKeyOrObject(number, false);
} else if (/[\w$_]/.test(c)) {
var id = this.findId();
switch(id){
case 'true':
this.addToken([VALUE_CONSTANTS,true]);
break;
case 'false':
this.addToken([VALUE_CONSTANTS,false]);
break;
case 'null':
this.addToken([VALUE_CONSTANTS,null]);
break;



default:
this.skipSpace(0);
if (this.previousType == OP_GET) {
this.addToken([VALUE_CONSTANTS,
id]);
} else {
this.addKeyOrObject(id, true);
}
}
} else {
var op = this.findOperator();

if( c=='.' && /\d/.test(this.value.charAt(this.start))){
var number = this.value.substr(this.start-1).match(/^\.\d+/)[0];
this.start+=number.length-1;
this.addKeyOrObject(1*number, false);
}else{

this.parseOperator(op);
if (op == null) {
this.parseError("未知操作符:");
}
}
}
this.skipSpace(0);
}
},
parseError:function(msg){
msg = msg+"\n@"+ this.start + "\n"
+ this.value.substring(this.start)+"\n----\n"+this.value
console.error(msg);
throw new Error(msg);
},
findOperator :function() {
var c = this.value.charAt(this.start);
var end = this.start+1;
var next = this.value.charAt(end);
switch (c) {
case ',':
case ':':
case '[':
case ']':
case '{':
case '}':
case '(':
case ')':
case '.':
case '?':
case '~':
case '^':
break;
case '+':
case '-':
case '*':
case '/':
case '%':
if(next == '=' ){
this.parseError("不支持赋值操作:");
}else if(next == c){
this.parseError("不支持自增自减操作:");
}
break;
case '=':
if(next == '='){
end++;
if(this.value.charAt(end) == '='){
end++;
}
}else{
this.parseError("不支持赋值操作:");
}
break;
case '!':
if(next == '='){
end++;
if(this.value.charAt(end) == '='){
end++;
}
}
break;
case '>':
case '<':
if (next == '=') {
end++;
}else if(next == c){
if(this.value.charAt(end) == c){
end++;
}
}
break;
case '&':
case '|':
if( (c == next)){
end++;
}
break;
default:
return null;
}
return this.value.substring(this.start, this.start = end);
},

isMapMethod :function() {
var i = this.tokens.length - 1;
var depth = 0;
for (; i >= 0; i--) {
var token = this.tokens[i];
var type = token[0];
if (depth == 0) {
if (type == OP_PUT
|| type == VALUE_MAP) {


return true;
} else if (type == OP_JOIN) {


return false;
}
}
if (type == BRACKET_BEGIN) {
depth--;
} else if (type == BRACKET_END) {
depth++;
}
}
return false;
},
parseOperator :function(op) {
if (op.length == 1) {
switch (op.charAt(0)) {
case '(':
if (this.status == STATUS_EXPRESSION) {
this.addToken([OP_INVOKE]);
if (this.skipSpace(')')) {
this.addToken([VALUE_CONSTANTS,
[]]);
this.start++;
} else {
this.addList();
}
} else {
this.addToken([BRACKET_BEGIN]);
}
break;
case '[':
if (this.status == STATUS_EXPRESSION) {
this.addToken([OP_GET]);
this.addToken([BRACKET_BEGIN]);
}else {
this.addList();
}
break;
case '{':
this.addMap();
break;
case '}':
case ']':
case ')':
this.addToken([BRACKET_END]);
break;
case '+':
this.addToken([
this.status == STATUS_EXPRESSION ? OP_ADD : OP_POS]);
break;
case '-':
this.addToken([
this.status == STATUS_EXPRESSION ? OP_SUB
: OP_NEG]);
break;
case ':':
this.addToken([OP_QUESTION_SELECT]);
break;
case ',':

if (this.isMapMethod()) {
this.status = STATUS_OPERATOR;
}else{
this.addToken([OP_JOIN]);
}
break;
case '/':
var next = this.value.charAt(this.start);
if (next == '/') {
var end1 = this.value.indexOf('\n', this.start);
var end2 = this.value.indexOf('\r', this.start);
var cend = Math.min(end1, end2);
if (cend < 0) {
cend = Math.max(end1, end2);
}
if (cend > 0) {
this.start = cend;
} else {
this.start = this.end;
}
break;
} else if (next == '*') {
var cend = this.value.indexOf("*/", this.start);
if (cend > 0) {
this.start = cend + 2;
} else {
throw new Error("未結束注釋:" + this.value
+ "@" + this.start);
}
break;
}else if(this.status != STATUS_EXPRESSION){
var end = findRegExp(this.value,this.start);
if(end>0){
this.addToken([VALUE_CONSTANTS,
toValue(
this.value.substring(this.start-1,end))]);
this.start = end;
break;
}else{
throw new Error("异常正则:"+this.value+'@'+this.start)
}


}
default:
this.addToken([findTokenType(op)]);
}
} else {
this.addToken([findTokenType(op)]);
}
},
addToken :function(token) {
var type= token[0];
if(type == VALUE_VAR){
if("in" == token[1]){
token[0] = type = OP_IN;
}
}
switch (type) {
case BRACKET_BEGIN:
this.status = STATUS_BEGIN;
break;
case VALUE_CONSTANTS:
case VALUE_VAR:
case BRACKET_END:
this.status = STATUS_EXPRESSION;
break;
default:
this.status = STATUS_OPERATOR;
break;
}

this.previousType = type;
this.tokens.push(token);
},
addKeyOrObject :function(object, isVar) {
if (this.skipSpace(':') && this.isMapMethod()) {
this.addToken([OP_PUT, object]);
this.start++;
} else if (isVar) {
this.addToken([VALUE_VAR, object]);
} else {
this.addToken([VALUE_CONSTANTS, object]);
}
},
addList :function() {
this.addToken([BRACKET_BEGIN]);
this.addToken([VALUE_LIST]);
if (!this.skipSpace(']')) {
this.addToken([OP_JOIN]);
}
},
addMap :function() {
this.addToken([BRACKET_BEGIN]);
this.addToken([VALUE_MAP]);
}
};
var pt = new JSONTokenizer('');
for(var n in fns){
pt[n] = fns[n]
}
function toValue(s){
var v= this.eval(s);
if(v instanceof RegExp){
v = {
"class":"RegExp",
'literal':s+''
}
}
return v;
}
function findRegExp(text,start){
var depth=0,c;
while(c = text.charAt(start++)){
if(c=='['){
depth = 1;
}else if(c==']'){
depth = 0;
}else if (c == '\\') {
start++;
}else if(depth == 0 && c == '/'){
while(c = text.charAt(start++)){
switch(c){
case 'g':
case 'i':
case 'm':
break;
default:
return start-1;
}
}
}
}
}

function ExpressionTokenizer(value){
this.value = value.replace(/^\s+|\s+$/g,'');
this.start = 0;
this.end = this.value.length;
this.status = STATUS_BEGIN;
this.previousType = STATUS_BEGIN;
this.tokens = [];
this.parseEL();
prepareSelect(this.tokens)
this.expression = buildTree(trimToken(right(this.tokens)));
}
function prepareSelect(tokens) {
var p1 = tokens.length;
while (p1--) {
var type1 = tokens[p1][0];
if (type1 == OP_QUESTION) { 
var pos = getSelectRange(tokens,p1, -1, -1);
tokens.splice(pos+1,0, [BRACKET_BEGIN]);
p1++;
} else if (type1 == OP_QUESTION_SELECT) {
var end = tokens.length;
var pos = getSelectRange(tokens,p1, 1, end);
tokens.splice(pos,0, [BRACKET_END]);
}
}
}
function getSelectRange(tokens,p2, inc, end) {
var dep = 0;
while ((p2 += inc) != end) {
var type2 = tokens[p2][0];
if (type2 > 0) {
if (type2 == BRACKET_BEGIN) {
dep += inc;
} else if (type2 == BRACKET_END) {
dep -= inc;
} else if (dep == 0 && getPriority(type2) <= getPriority(OP_QUESTION)) {
return p2;
}
if (dep < 0) {
return p2;
}
}
}
return inc > 0 ? end : -1;
}
function buildTree(tokens){
var stack = [];
for(var i=0;i<tokens.length;i++){
var item = tokens[i]
var type = item[0];
switch(type){
case VALUE_CONSTANTS:
case VALUE_VAR:
case VALUE_LIST:
case VALUE_MAP:
stack.push(item);
break;
default:
if(getTokenParamIndex(type) ==3){
var arg2 = stack.pop();
var arg1 = stack.pop();
var el = [type,arg1,arg2]
}else{
var arg1 = stack.pop();
var el = [type,arg1]
}
if(hasTokenParam(type)){
el[getTokenParamIndex(type)] = item[1];
}
stack.push(el)
}
}
return stack[0];
}
ExpressionTokenizer.prototype = pt;

function right(tokens) {
var rightStack = [[]];
var buffer = [];
for (var i = 0;i<tokens.length;i++) {
var item = tokens[i];
if (item[0] > 0) {
if (buffer.length == 0) {
buffer.push(item);
} else if (item[0] == BRACKET_BEGIN) {
buffer.push(item);
} else if (item[0] == BRACKET_END) {
while (true) {
var operator = buffer.pop();
if (operator[0] == BRACKET_BEGIN) {
break;
}
addRightToken(rightStack, operator);
}
} else {
while (buffer.length!=0
&& rightEnd(item[0], buffer[buffer.length-1][0])) {
var operator = buffer.pop();


addRightToken(rightStack, operator);
}
buffer.push(item);
}
} else {
addRightToken(rightStack, item);
}
}
while (buffer.length !=0) {
var operator = buffer.pop();
addRightToken(rightStack, operator);
}
return rightStack[rightStack.length-1];
}
function trimToken(tokens){
for(var i=0;i<tokens.length;i++){
var token = tokens[i];
token.length = getTokenLength(token[0]);
}
return tokens;
}
function addRightToken(rightStack,
token) {
var list = rightStack[rightStack.length-1];










list.push(token);
}
function getPriority(type) {
switch (type) {
case BRACKET_BEGIN:
case BRACKET_END:
return Math.MIN_VALUE;
default:
return (type & BIT_PRIORITY)<<4 | (type & BIT_PRIORITY_SUB)>>8;
}
}

function rightEnd(currentType, priviousType) {
var priviousPriority = getPriority(priviousType);
var currentPriority = getPriority(currentType);
return currentPriority <= priviousPriority;
}
if(typeof require == 'function'){
exports.getPriority=getPriority;
exports.ExpressionTokenizer=ExpressionTokenizer;
var hasTokenParam=require(33).hasTokenParam;
var getTokenParam=require(33).getTokenParam;
var hasTokenParam=require(33).hasTokenParam;
var getTokenParamIndex=require(33).getTokenParamIndex;
var getTokenLength=require(33).getTokenLength;
var findTokenType=require(33).findTokenType;
var BIT_PRIORITY=require(33).BIT_PRIORITY;
var BIT_PRIORITY_SUB=require(33).BIT_PRIORITY_SUB;
var OP_ADD=require(33).OP_ADD;
var OP_GET=require(33).OP_GET;
var OP_IN=require(33).OP_IN;
var OP_INVOKE=require(33).OP_INVOKE;
var OP_JOIN=require(33).OP_JOIN;
var OP_NE=require(33).OP_NE;
var OP_NEG=require(33).OP_NEG;
var OP_POS=require(33).OP_POS;
var OP_PUT=require(33).OP_PUT;
var OP_QUESTION=require(33).OP_QUESTION;
var OP_QUESTION_SELECT=require(33).OP_QUESTION_SELECT;
var OP_SUB=require(33).OP_SUB;
var VALUE_CONSTANTS=require(33).VALUE_CONSTANTS;
var VALUE_LIST=require(33).VALUE_LIST;
var VALUE_MAP=require(33).VALUE_MAP;
var VALUE_VAR=require(33).VALUE_VAR;
}
}
,
function(exports,require){


var nameStartChar = /[A-Z_a-z\xC0-\xD6\xD8-\xF6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/
var nameChar = new RegExp("[\\-\\.0-9"+nameStartChar.source.slice(1,-1)+"\\u00B7\\u0300-\\u036F\\u203F-\\u2040]");
var tagNamePattern = new RegExp('^'+nameStartChar.source+nameChar.source+'*(?:\:'+nameStartChar.source+nameChar.source+'*)?$');




var S_TAG = 0;
var S_ATTR = 1;
var S_ATTR_SPACE=2;
var S_EQ = 3;
var S_ATTR_NOQUOT_VALUE = 4;
var S_ATTR_END = 5;
var S_TAG_SPACE = 6;
var S_TAG_CLOSE = 7;
function XMLReader(){
}
XMLReader.prototype = {
parse:function(source,defaultNSMap,entityMap){
var domBuilder = this.domBuilder;
domBuilder.startDocument();
_copy(defaultNSMap ,defaultNSMap = {})
parse(source,defaultNSMap,entityMap,
domBuilder,this.errorHandler);
domBuilder.endDocument();
}
}
function parse(source,defaultNSMapCopy,entityMap,domBuilder,errorHandler){
function fixedFromCharCode(code) {


if (code > 0xffff) {
code -= 0x10000;
var surrogate1 = 0xd800 + (code >> 10)
, surrogate2 = 0xdc00 + (code & 0x3ff);
return String.fromCharCode(surrogate1, surrogate2);
} else {
return String.fromCharCode(code);
}
}
function entityReplacer(a){
var k = a.slice(1,-1);
if(k in entityMap){
return entityMap[k]; 
}else if(k.charAt(0) === '#'){
return fixedFromCharCode(parseInt(k.substr(1).replace('x','0x')))
}else{
errorHandler.error('entity not found:'+a);
return a;
}
}
function appendText(end){
if(end>start){
var xt = source.substring(start,end).replace(/&#?\w+;/g,entityReplacer);
locator&&position(start);
domBuilder.characters(xt,0,end-start);
start = end
}
}
function position(p,m){
while(p>=lineEnd && (m = linePattern.exec(source))){
lineStart = m.index;
lineEnd = lineStart + m[0].length;
locator.lineNumber++;

}
locator.columnNumber = p-lineStart+1;
}
var lineStart = 0;
var lineEnd = 0;
var linePattern = /.*(?:\r\n?|\n)|.*$/g
var locator = domBuilder.locator;
var parseStack = [{currentNSMap:defaultNSMapCopy}]
var closeMap = {};
var start = 0;
while(true){
try{
var tagStart = source.indexOf('<',start);
if(tagStart<0){
if(!source.substr(start).match(/^\s*$/)){
var doc = domBuilder.doc;
var text = doc.createTextNode(source.substr(start));
doc.appendChild(text);
domBuilder.currentElement = text;
}
return;
}
if(tagStart>start){
appendText(tagStart);
}
switch(source.charAt(tagStart+1)){
case '/':
var end = source.indexOf('>',tagStart+3);
var tagName = source.substring(tagStart+2,end);
var config = parseStack.pop();
if(end<0){
tagName = source.substring(tagStart+2).replace(/[\s<].*/,'');

errorHandler.error("end tag name: "+tagName+' is not complete:'+config.tagName);
end = tagStart+1+tagName.length;
}else if(tagName.match(/\s</)){
tagName = tagName.replace(/[\s<].*/,'');
errorHandler.error("end tag name: "+tagName+' maybe not complete');
end = tagStart+1+tagName.length;
}


var localNSMap = config.localNSMap;
var endMatch = config.tagName == tagName;
var endIgnoreCaseMach = endMatch || config.tagName&&config.tagName.toLowerCase() == tagName.toLowerCase()
if(endIgnoreCaseMach){
domBuilder.endElement(config.uri,config.localName,tagName);
if(localNSMap){
for(var prefix in localNSMap){
domBuilder.endPrefixMapping(prefix) ;
}
}
if(!endMatch){
errorHandler.fatalError("end tag name: "+tagName+' is not match the current start tagName:'+config.tagName );
}
}else{
parseStack.push(config)
}
end++;
break;

case '?':
locator&&position(tagStart);
end = parseInstruction(source,tagStart,domBuilder);
break;
case '!':
locator&&position(tagStart);
end = parseDCC(source,tagStart,domBuilder,errorHandler);
break;
default:
locator&&position(tagStart);
var el = new ElementAttributes();
var currentNSMap = parseStack[parseStack.length-1].currentNSMap;

var end = parseElementStartPart(source,tagStart,el,currentNSMap,entityReplacer,errorHandler);
var len = el.length;
if(!el.closed && fixSelfClosed(source,end,el.tagName,closeMap)){
el.closed = true;
if(!entityMap.nbsp){
errorHandler.warning('unclosed xml attribute');
}
}
if(locator && len){
var locator2 = copyLocator(locator,{});

for(var i = 0;i<len;i++){
var a = el[i];
position(a.offset);
a.locator = copyLocator(locator,{});
}

domBuilder.locator = locator2
if(appendElement(el,domBuilder,currentNSMap)){
parseStack.push(el)
}
domBuilder.locator = locator;
}else{
if(appendElement(el,domBuilder,currentNSMap)){
parseStack.push(el)
}
}
if(el.uri === 'http://www.w3.org/1999/xhtml' && !el.closed){
end = parseHtmlSpecialContent(source,end,el.tagName,entityReplacer,domBuilder)
}else{
end++;
}
}
}catch(e){
errorHandler.error('element parse error: '+e)

end = -1;

}
if(end>start){
start = end;
}else{

appendText(Math.max(tagStart,start)+1);
}
}
}
function copyLocator(f,t){
t.lineNumber = f.lineNumber;
t.columnNumber = f.columnNumber;
return t;
}

function parseElementStartPart(source,start,el,currentNSMap,entityReplacer,errorHandler){
var attrName;
var value;
var p = ++start;
var s = S_TAG;
while(true){
var c = source.charAt(p);
switch(c){
case '=':
if(s === S_ATTR){
attrName = source.slice(start,p);
s = S_EQ;
}else if(s === S_ATTR_SPACE){
s = S_EQ;
}else{

throw new Error('attribute equal must after attrName');
}
break;
case '\'':
case '"':
if(s === S_EQ || s === S_ATTR 
){
if(s === S_ATTR){
errorHandler.warning('attribute value must after "="')
attrName = source.slice(start,p)
}
start = p+1;
p = source.indexOf(c,start)
if(p>0){
value = source.slice(start,p).replace(/&#?\w+;/g,entityReplacer);
el.add(attrName,value,start-1);
s = S_ATTR_END;
}else{

throw new Error('attribute value no end \''+c+'\' match');
}
}else if(s == S_ATTR_NOQUOT_VALUE){
value = source.slice(start,p).replace(/&#?\w+;/g,entityReplacer);

el.add(attrName,value,start);

errorHandler.warning('attribute "'+attrName+'" missed start quot('+c+')!!');
start = p+1;
s = S_ATTR_END
}else{

throw new Error('attribute value must after "="');
}
break;
case '/':
switch(s){
case S_TAG:
el.setTagName(source.slice(start,p));
case S_ATTR_END:
case S_TAG_SPACE:
case S_TAG_CLOSE:
s =S_TAG_CLOSE;
el.closed = true;
case S_ATTR_NOQUOT_VALUE:
case S_ATTR:
case S_ATTR_SPACE:
break;

default:
throw new Error("attribute invalid close char('/')")
}
break;
case '':

errorHandler.error('unexpected end of input');
if(s == S_TAG){
el.setTagName(source.slice(start,p));
}
return p;
case '>':
switch(s){
case S_TAG:
el.setTagName(source.slice(start,p));
case S_ATTR_END:
case S_TAG_SPACE:
case S_TAG_CLOSE:
break;
case S_ATTR_NOQUOT_VALUE:
case S_ATTR:
value = source.slice(start,p);
if(value.slice(-1) === '/'){
el.closed = true;
value = value.slice(0,-1)
}
case S_ATTR_SPACE:
if(s === S_ATTR_SPACE){
value = attrName;
}
if(s == S_ATTR_NOQUOT_VALUE){
errorHandler.warning('attribute "'+value+'" missed quot(")!!');
el.add(attrName,value.replace(/&#?\w+;/g,entityReplacer),start)
}else{
if(currentNSMap[''] !== 'http://www.w3.org/1999/xhtml' || !value.match(/^(?:disabled|checked|selected)$/i)){
errorHandler.warning('attribute "'+value+'" missed value!! "'+value+'" instead!!')
}
el.add(value,value,start)
}
break;
case S_EQ:
throw new Error('attribute value missed!!');
}

return p;

case '\u0080':
c = ' ';
default:
if(c<= ' '){
switch(s){
case S_TAG:
el.setTagName(source.slice(start,p));
s = S_TAG_SPACE;
break;
case S_ATTR:
attrName = source.slice(start,p)
s = S_ATTR_SPACE;
break;
case S_ATTR_NOQUOT_VALUE:
var value = source.slice(start,p).replace(/&#?\w+;/g,entityReplacer);
errorHandler.warning('attribute "'+value+'" missed quot(")!!');
el.add(attrName,value,start)
case S_ATTR_END:
s = S_TAG_SPACE;
break;






}
}else{


switch(s){



case S_ATTR_SPACE:
var tagName = el.tagName;
if(currentNSMap[''] !== 'http://www.w3.org/1999/xhtml' || !attrName.match(/^(?:disabled|checked|selected)$/i)){
errorHandler.warning('attribute "'+attrName+'" missed value!! "'+attrName+'" instead2!!')
}
el.add(attrName,attrName,start);
start = p;
s = S_ATTR;
break;
case S_ATTR_END:
errorHandler.warning('attribute space is required"'+attrName+'"!!')
case S_TAG_SPACE:
s = S_ATTR;
start = p;
break;
case S_EQ:
s = S_ATTR_NOQUOT_VALUE;
start = p;
break;
case S_TAG_CLOSE:
throw new Error("elements closed character '/' and '>' must be connected to");
}
}
}

p++;
}
}

function appendElement(el,domBuilder,currentNSMap){
var tagName = el.tagName;
var localNSMap = null;

var i = el.length;
while(i--){
var a = el[i];
var qName = a.qName;
var value = a.value;
var nsp = qName.indexOf(':');
if(nsp>0){
var prefix = a.prefix = qName.slice(0,nsp);
var localName = qName.slice(nsp+1);
var nsPrefix = prefix === 'xmlns' && localName
}else{
localName = qName;
prefix = null
nsPrefix = qName === 'xmlns' && ''
}

a.localName = localName ;

if(nsPrefix !== false){
if(localNSMap == null){
localNSMap = {}

_copy(currentNSMap,currentNSMap={})

}
currentNSMap[nsPrefix] = localNSMap[nsPrefix] = value;
a.uri = 'http://www.w3.org/2000/xmlns/'
domBuilder.startPrefixMapping(nsPrefix, value) 
}
}
var i = el.length;
while(i--){
a = el[i];
var prefix = a.prefix;
if(prefix){
if(prefix === 'xml'){
a.uri = 'http://www.w3.org/XML/1998/namespace';
}if(prefix !== 'xmlns'){
a.uri = currentNSMap[prefix || '']

}
}
}
var nsp = tagName.indexOf(':');
if(nsp>0){
prefix = el.prefix = tagName.slice(0,nsp);
localName = el.localName = tagName.slice(nsp+1);
}else{
prefix = null;
localName = el.localName = tagName;
}

var ns = el.uri = currentNSMap[prefix || ''];
domBuilder.startElement(ns,localName,tagName,el);


if(el.closed){
domBuilder.endElement(ns,localName,tagName);
if(localNSMap){
for(prefix in localNSMap){
domBuilder.endPrefixMapping(prefix) 
}
}
}else{
el.currentNSMap = currentNSMap;
el.localNSMap = localNSMap;

return true;
}
}
function parseHtmlSpecialContent(source,elStartEnd,tagName,entityReplacer,domBuilder){
if(/^(?:script|textarea)$/i.test(tagName)){
var elEndStart = source.indexOf('</'+tagName+'>',elStartEnd);
var text = source.substring(elStartEnd+1,elEndStart);
if(/[&<]/.test(text)){
if(/^script$/i.test(tagName)){


domBuilder.characters(text,0,text.length);

return elEndStart;

}
text = text.replace(/&#?\w+;/g,entityReplacer);
domBuilder.characters(text,0,text.length);
return elEndStart;

}
}
return elStartEnd+1;
}
function fixSelfClosed(source,elStartEnd,tagName,closeMap){

var pos = closeMap[tagName];
if(pos == null){

pos = source.lastIndexOf('</'+tagName+'>')
if(pos<elStartEnd){
pos = source.lastIndexOf('</'+tagName)
}
closeMap[tagName] =pos
}
return pos<elStartEnd;

}
function _copy(source,target){
for(var n in source){target[n] = source[n]}
}
function parseDCC(source,start,domBuilder,errorHandler){
var next= source.charAt(start+2)
switch(next){
case '-':
if(source.charAt(start + 3) === '-'){
var end = source.indexOf('-->',start+4);

if(end>start){
domBuilder.comment(source,start+4,end-start-4);
return end+3;
}else{
errorHandler.error("Unclosed comment");
return -1;
}
}else{

return -1;
}
default:
if(source.substr(start+3,6) == 'CDATA['){
var end = source.indexOf(']]>',start+9);
domBuilder.startCDATA();
domBuilder.characters(source,start+9,end-start-9);
domBuilder.endCDATA() 
return end+3;
}


var matchs = split(source,start);
var len = matchs.length;
if(len>1 && /!doctype/i.test(matchs[0][0])){
var name = matchs[1][0];
var pubid = len>3 && /^public$/i.test(matchs[2][0]) && matchs[3][0]
var sysid = len>4 && matchs[4][0];
var lastMatch = matchs[len-1]
domBuilder.startDTD(name,pubid && pubid.replace(/^(['"])(.*?)\1$/,'$2'),
sysid && sysid.replace(/^(['"])(.*?)\1$/,'$2'));
domBuilder.endDTD();
return lastMatch.index+lastMatch[0].length
}
}
return -1;
}
function parseInstruction(source,start,domBuilder){
var end = source.indexOf('?>',start);
if(end){
var match = source.substring(start,end).match(/^<\?(\S*)\s*([\s\S]*?)\s*$/);
if(match){
var len = match[0].length;
domBuilder.processingInstruction(match[1], match[2]) ;
return end+2;
}else{
return -1;
}
}
return -1;
}

function ElementAttributes(source){
}
ElementAttributes.prototype = {
setTagName:function(tagName){
if(!tagNamePattern.test(tagName)){
throw new Error('invalid tagName:'+tagName)
}
this.tagName = tagName
},
add:function(qName,value,offset){
if(!tagNamePattern.test(qName)){
throw new Error('invalid attribute:'+qName)
}
this[this.length++] = {qName:qName,value:value,offset:offset}
},
length:0,
getLocalName:function(i){return this[i].localName},
getLocator:function(i){return this[i].locator},
getQName:function(i){return this[i].qName},
getURI:function(i){return this[i].uri},
getValue:function(i){return this[i].value}










}
function _set_proto_(thiz,parent){
thiz.__proto__ = parent;
return thiz;
}
if(!(_set_proto_({},_set_proto_.prototype) instanceof _set_proto_)){
_set_proto_ = function(thiz,parent){
function p(){};
p.prototype = parent;
p = new p();
for(parent in thiz){
p[parent] = thiz[parent];
}
return p;
}
}
function split(source,start){
var match;
var buf = [];
var reg = /'[^']+'|"[^"]+"|[^\s<>\/=]+=?|(\/?\s*>|<)/g;
reg.lastIndex = start;
reg.exec(source);
while(match = reg.exec(source)){
buf.push(match);
if(match[1])return buf;
}
}
exports.XMLReader = XMLReader;
}
,
function(exports,require){
function copy(src,dest){
for(var p in src){
dest[p] = src[p];
}
}

function _extends(Class,Super){
var pt = Class.prototype;
if(Object.create){
var ppt = Object.create(Super.prototype)
pt.__proto__ = ppt;
}
if(!(pt instanceof Super)){
function t(){};
t.prototype = Super.prototype;
t = new t();
copy(pt,t);
Class.prototype = pt = t;
}
if(pt.constructor != Class){
if(typeof Class != 'function'){
console.error("unknow Class:"+Class)
}
pt.constructor = Class
}
}
var htmlns = 'http://www.w3.org/1999/xhtml' ;

var NodeType = {}
var ELEMENT_NODE = NodeType.ELEMENT_NODE = 1;
var ATTRIBUTE_NODE = NodeType.ATTRIBUTE_NODE = 2;
var TEXT_NODE = NodeType.TEXT_NODE = 3;
var CDATA_SECTION_NODE = NodeType.CDATA_SECTION_NODE = 4;
var ENTITY_REFERENCE_NODE = NodeType.ENTITY_REFERENCE_NODE = 5;
var ENTITY_NODE = NodeType.ENTITY_NODE = 6;
var PROCESSING_INSTRUCTION_NODE = NodeType.PROCESSING_INSTRUCTION_NODE = 7;
var COMMENT_NODE = NodeType.COMMENT_NODE = 8;
var DOCUMENT_NODE = NodeType.DOCUMENT_NODE = 9;
var DOCUMENT_TYPE_NODE = NodeType.DOCUMENT_TYPE_NODE = 10;
var DOCUMENT_FRAGMENT_NODE = NodeType.DOCUMENT_FRAGMENT_NODE = 11;
var NOTATION_NODE = NodeType.NOTATION_NODE = 12;

var ExceptionCode = {}
var ExceptionMessage = {};
var INDEX_SIZE_ERR = ExceptionCode.INDEX_SIZE_ERR = ((ExceptionMessage[1]="Index size error"),1);
var DOMSTRING_SIZE_ERR = ExceptionCode.DOMSTRING_SIZE_ERR = ((ExceptionMessage[2]="DOMString size error"),2);
var HIERARCHY_REQUEST_ERR = ExceptionCode.HIERARCHY_REQUEST_ERR = ((ExceptionMessage[3]="Hierarchy request error"),3);
var WRONG_DOCUMENT_ERR = ExceptionCode.WRONG_DOCUMENT_ERR = ((ExceptionMessage[4]="Wrong document"),4);
var INVALID_CHARACTER_ERR = ExceptionCode.INVALID_CHARACTER_ERR = ((ExceptionMessage[5]="Invalid character"),5);
var NO_DATA_ALLOWED_ERR = ExceptionCode.NO_DATA_ALLOWED_ERR = ((ExceptionMessage[6]="No data allowed"),6);
var NO_MODIFICATION_ALLOWED_ERR = ExceptionCode.NO_MODIFICATION_ALLOWED_ERR = ((ExceptionMessage[7]="No modification allowed"),7);
var NOT_FOUND_ERR = ExceptionCode.NOT_FOUND_ERR = ((ExceptionMessage[8]="Not found"),8);
var NOT_SUPPORTED_ERR = ExceptionCode.NOT_SUPPORTED_ERR = ((ExceptionMessage[9]="Not supported"),9);
var INUSE_ATTRIBUTE_ERR = ExceptionCode.INUSE_ATTRIBUTE_ERR = ((ExceptionMessage[10]="Attribute in use"),10);

var INVALID_STATE_ERR	= ExceptionCode.INVALID_STATE_ERR	= ((ExceptionMessage[11]="Invalid state"),11);
var SYNTAX_ERR	= ExceptionCode.SYNTAX_ERR	= ((ExceptionMessage[12]="Syntax error"),12);
var INVALID_MODIFICATION_ERR	= ExceptionCode.INVALID_MODIFICATION_ERR	= ((ExceptionMessage[13]="Invalid modification"),13);
var NAMESPACE_ERR	= ExceptionCode.NAMESPACE_ERR	= ((ExceptionMessage[14]="Invalid namespace"),14);
var INVALID_ACCESS_ERR	= ExceptionCode.INVALID_ACCESS_ERR	= ((ExceptionMessage[15]="Invalid access"),15);
function DOMException(code, message) {
if(message instanceof Error){
var error = message;
}else{
error = this;
Error.call(this, ExceptionMessage[code]);
this.message = ExceptionMessage[code];
if(Error.captureStackTrace) Error.captureStackTrace(this, DOMException);
}
error.code = code;
if(message) this.message = this.message + ": " + message;
return error;
};
DOMException.prototype = Error.prototype;
copy(ExceptionCode,DOMException)

function NodeList() {
};
NodeList.prototype = {

length:0, 

item: function(index) {
return this[index] || null;
},
toString:function(isHTML,nodeFilter){
for(var buf = [], i = 0;i<this.length;i++){
serializeToString(this[i],buf,isHTML,nodeFilter);
}
return buf.join('');
}
};
function LiveNodeList(node,refresh){
this._node = node;
this._refresh = refresh
_updateLiveList(this);
}
function _updateLiveList(list){
var inc = list._node._inc || list._node.ownerDocument._inc;
if(list._inc != inc){
var ls = list._refresh(list._node);

__set__(list,'length',ls.length);
copy(ls,list);
list._inc = inc;
}
}
LiveNodeList.prototype.item = function(i){
_updateLiveList(this);
return this[i];
}
_extends(LiveNodeList,NodeList);

function NamedNodeMap() {
};
function _findNodeIndex(list,node){
var i = list.length;
while(i--){
if(list[i] === node){return i}
}
}
function _addNamedNode(el,list,newAttr,oldAttr){
if(oldAttr){
list[_findNodeIndex(list,oldAttr)] = newAttr;
}else{
list[list.length++] = newAttr;
}
if(el){
newAttr.ownerElement = el;
var doc = el.ownerDocument;
if(doc){
oldAttr && _onRemoveAttribute(doc,el,oldAttr);
_onAddAttribute(doc,el,newAttr);
}
}
}
function _removeNamedNode(el,list,attr){

var i = _findNodeIndex(list,attr);
if(i>=0){
var lastIndex = list.length-1
while(i<lastIndex){
list[i] = list[++i]
}
list.length = lastIndex;
if(el){
var doc = el.ownerDocument;
if(doc){
_onRemoveAttribute(doc,el,attr);
attr.ownerElement = null;
}
}
}else{
throw DOMException(NOT_FOUND_ERR,new Error(el.tagName+'@'+attr))
}
}
NamedNodeMap.prototype = {
length:0,
item:NodeList.prototype.item,
getNamedItem: function(key) {




var i = this.length;
while(i--){
var attr = this[i];

if(attr.nodeName == key){
return attr;
}
}
},
setNamedItem: function(attr) {
var el = attr.ownerElement;
if(el && el!=this._ownerElement){
throw new DOMException(INUSE_ATTRIBUTE_ERR);
}
var oldAttr = this.getNamedItem(attr.nodeName);
_addNamedNode(this._ownerElement,this,attr,oldAttr);
return oldAttr;
},

setNamedItemNS: function(attr) {
var el = attr.ownerElement, oldAttr;
if(el && el!=this._ownerElement){
throw new DOMException(INUSE_ATTRIBUTE_ERR);
}
oldAttr = this.getNamedItemNS(attr.namespaceURI,attr.localName);
_addNamedNode(this._ownerElement,this,attr,oldAttr);
return oldAttr;
},

removeNamedItem: function(key) {
var attr = this.getNamedItem(key);
_removeNamedNode(this._ownerElement,this,attr);
return attr;
},

removeNamedItemNS:function(namespaceURI,localName){
var attr = this.getNamedItemNS(namespaceURI,localName);
_removeNamedNode(this._ownerElement,this,attr);
return attr;
},
getNamedItemNS: function(namespaceURI, localName) {
var i = this.length;
while(i--){
var node = this[i];
if(node.localName == localName && node.namespaceURI == namespaceURI){
return node;
}
}
return null;
}
};

function DOMImplementation( features) {
this._features = {};
if (features) {
for (var feature in features) {
this._features = features[feature];
}
}
};
DOMImplementation.prototype = {
hasFeature: function( feature,  version) {
var versions = this._features[feature.toLowerCase()];
if (versions && (!version || version in versions)) {
return true;
} else {
return false;
}
},

createDocument:function(namespaceURI, qualifiedName, doctype){
var doc = new Document();
doc.implementation = this;
doc.childNodes = new NodeList();
doc.doctype = doctype;
if(doctype){
doc.appendChild(doctype);
}
if(qualifiedName){
var root = doc.createElementNS(namespaceURI,qualifiedName);
doc.appendChild(root);
}
return doc;
},

createDocumentType:function(qualifiedName, publicId, systemId){
var node = new DocumentType();
node.name = qualifiedName;
node.nodeName = qualifiedName;
node.publicId = publicId;
node.systemId = systemId;





return node;
}
};

function Node() {
};
Node.prototype = {
firstChild : null,
lastChild : null,
previousSibling : null,
nextSibling : null,
attributes : null,
parentNode : null,
childNodes : null,
ownerDocument : null,
nodeValue : null,
namespaceURI : null,
prefix : null,
localName : null,

insertBefore:function(newChild, refChild){
return _insertBefore(this,newChild,refChild);
},
replaceChild:function(newChild, oldChild){
this.insertBefore(newChild,oldChild);
if(oldChild){
this.removeChild(oldChild);
}
},
removeChild:function(oldChild){
return _removeChild(this,oldChild);
},
appendChild:function(newChild){
return this.insertBefore(newChild,null);
},
hasChildNodes:function(){
return this.firstChild != null;
},
cloneNode:function(deep){
return cloneNode(this.ownerDocument||this,this,deep);
},

normalize:function(){
var child = this.firstChild;
while(child){
var next = child.nextSibling;
if(next && next.nodeType == TEXT_NODE && child.nodeType == TEXT_NODE){
this.removeChild(next);
child.appendData(next.data);
}else{
child.normalize();
child = next;
}
}
},

isSupported:function(feature, version){
return this.ownerDocument.implementation.hasFeature(feature,version);
},

hasAttributes:function(){
return this.attributes.length>0;
},
lookupPrefix:function(namespaceURI){
var el = this;
while(el){
var map = el._nsMap;

if(map){
for(var n in map){
if(map[n] == namespaceURI){
return n;
}
}
}
el = el.nodeType == ATTRIBUTE_NODE?el.ownerDocument : el.parentNode;
}
return null;
},

lookupNamespaceURI:function(prefix){
var el = this;
while(el){
var map = el._nsMap;

if(map){
if(prefix in map){
return map[prefix] ;
}
}
el = el.nodeType == ATTRIBUTE_NODE?el.ownerDocument : el.parentNode;
}
return null;
},

isDefaultNamespace:function(namespaceURI){
var prefix = this.lookupPrefix(namespaceURI);
return prefix == null;
}
};
function _xmlEncoder(c){
return c == '<' && '&lt;' ||
c == '>' && '&gt;' ||
c == '&' && '&amp;' ||
c == '"' && '&quot;' ||
'&#'+c.charCodeAt()+';'
}
copy(NodeType,Node);
copy(NodeType,Node.prototype);

function _visitNode(node,callback){
if(callback(node)){
return true;
}
if(node = node.firstChild){
do{
if(_visitNode(node,callback)){return true}
}while(node=node.nextSibling)
}
}
function Document(){
}
function _onAddAttribute(doc,el,newAttr){
doc && doc._inc++;
var ns = newAttr.namespaceURI ;
if(ns == 'http://www.w3.org/2000/xmlns/'){

el._nsMap[newAttr.prefix?newAttr.localName:''] = newAttr.value
}
}
function _onRemoveAttribute(doc,el,newAttr,remove){
doc && doc._inc++;
var ns = newAttr.namespaceURI ;
if(ns == 'http://www.w3.org/2000/xmlns/'){

delete el._nsMap[newAttr.prefix?newAttr.localName:'']
}
}
function _onUpdateChild(doc,el,newChild){
if(doc && doc._inc){
doc._inc++;

var cs = el.childNodes;
if(newChild){
cs[cs.length++] = newChild;
}else{

var child = el.firstChild;
var i = 0;
while(child){
cs[i++] = child;
child =child.nextSibling;
}
cs.length = i;
}
}
}

function _removeChild(parentNode,child){
var previous = child.previousSibling;
var next = child.nextSibling;
if(previous){
previous.nextSibling = next;
}else{
parentNode.firstChild = next
}
if(next){
next.previousSibling = previous;
}else{
parentNode.lastChild = previous;
}
_onUpdateChild(parentNode.ownerDocument,parentNode);
return child;
}

function _insertBefore(parentNode,newChild,nextChild){
var cp = newChild.parentNode;
if(cp){
cp.removeChild(newChild);
}
if(newChild.nodeType === DOCUMENT_FRAGMENT_NODE){
var newFirst = newChild.firstChild;
if (newFirst == null) {
return newChild;
}
var newLast = newChild.lastChild;
}else{
newFirst = newLast = newChild;
}
var pre = nextChild ? nextChild.previousSibling : parentNode.lastChild;
newFirst.previousSibling = pre;
newLast.nextSibling = nextChild;
if(pre){
pre.nextSibling = newFirst;
}else{
parentNode.firstChild = newFirst;
}
if(nextChild == null){
parentNode.lastChild = newLast;
}else{
nextChild.previousSibling = newLast;
}
do{
newFirst.parentNode = parentNode;
}while(newFirst !== newLast && (newFirst= newFirst.nextSibling))
_onUpdateChild(parentNode.ownerDocument||parentNode,parentNode);

if (newChild.nodeType == DOCUMENT_FRAGMENT_NODE) {
newChild.firstChild = newChild.lastChild = null;
}
return newChild;
}
function _appendSingleChild(parentNode,newChild){
var cp = newChild.parentNode;
if(cp){
var pre = parentNode.lastChild;
cp.removeChild(newChild);
var pre = parentNode.lastChild;
}
var pre = parentNode.lastChild;
newChild.parentNode = parentNode;
newChild.previousSibling = pre;
newChild.nextSibling = null;
if(pre){
pre.nextSibling = newChild;
}else{
parentNode.firstChild = newChild;
}
parentNode.lastChild = newChild;
_onUpdateChild(parentNode.ownerDocument,parentNode,newChild);
return newChild;

}
Document.prototype = {

nodeName : '#document',
nodeType : DOCUMENT_NODE,
doctype : null,
documentElement : null,
_inc : 1,
insertBefore : function(newChild, refChild){
if(newChild.nodeType == DOCUMENT_FRAGMENT_NODE){
var child = newChild.firstChild;
while(child){
var next = child.nextSibling;
this.insertBefore(child,refChild);
child = next;
}
return newChild;
}
if(this.documentElement == null && newChild.nodeType == ELEMENT_NODE){
this.documentElement = newChild;
}
return _insertBefore(this,newChild,refChild),(newChild.ownerDocument = this),newChild;
},
removeChild : function(oldChild){
if(this.documentElement == oldChild){
this.documentElement = null;
}
return _removeChild(this,oldChild);
},

importNode : function(importedNode,deep){
return importNode(this,importedNode,deep);
},

getElementById :	function(id){
var rtv = null;
_visitNode(this.documentElement,function(node){
if(node.nodeType == ELEMENT_NODE){
if(node.getAttribute('id') == id){
rtv = node;
return true;
}
}
})
return rtv;
},

createElement :	function(tagName){
var node = new Element();
node.ownerDocument = this;
node.nodeName = tagName;
node.tagName = tagName;
node.childNodes = new NodeList();
var attrs	= node.attributes = new NamedNodeMap();
attrs._ownerElement = node;
return node;
},
createDocumentFragment :	function(){
var node = new DocumentFragment();
node.ownerDocument = this;
node.childNodes = new NodeList();
return node;
},
createTextNode :	function(data){
var node = new Text();
node.ownerDocument = this;
node.appendData(data)
return node;
},
createComment :	function(data){
var node = new Comment();
node.ownerDocument = this;
node.appendData(data)
return node;
},
createCDATASection :	function(data){
var node = new CDATASection();
node.ownerDocument = this;
node.appendData(data)
return node;
},
createProcessingInstruction :	function(target,data){
var node = new ProcessingInstruction();
node.ownerDocument = this;
node.tagName = node.target = target;
node.nodeValue= node.data = data;
return node;
},
createAttribute :	function(name){
var node = new Attr();
node.ownerDocument	= this;
node.name = name;
node.nodeName	= name;
node.localName = name;
node.specified = true;
return node;
},
createEntityReference :	function(name){
var node = new EntityReference();
node.ownerDocument	= this;
node.nodeName	= name;
return node;
},

createElementNS :	function(namespaceURI,qualifiedName){
var node = new Element();
var pl = qualifiedName.split(':');
var attrs	= node.attributes = new NamedNodeMap();
node.childNodes = new NodeList();
node.ownerDocument = this;
node.nodeName = qualifiedName;
node.tagName = qualifiedName;
node.namespaceURI = namespaceURI;
if(pl.length == 2){
node.prefix = pl[0];
node.localName = pl[1];
}else{

node.localName = qualifiedName;
}
attrs._ownerElement = node;
return node;
},

createAttributeNS :	function(namespaceURI,qualifiedName){
var node = new Attr();
var pl = qualifiedName.split(':');
node.ownerDocument = this;
node.nodeName = qualifiedName;
node.name = qualifiedName;
node.namespaceURI = namespaceURI;
node.specified = true;
if(pl.length == 2){
node.prefix = pl[0];
node.localName = pl[1];
}else{

node.localName = qualifiedName;
}
return node;
}
};
_extends(Document,Node);
function Element() {
this._nsMap = {};
};
Element.prototype = {
nodeType : ELEMENT_NODE,
hasAttribute : function(name){
return this.getAttributeNode(name)!=null;
},
getAttribute : function(name){
var attr = this.getAttributeNode(name);
return attr && attr.value || '';
},
getAttributeNode : function(name){
return this.attributes.getNamedItem(name);
},
setAttribute : function(name, value){
var attr = this.ownerDocument.createAttribute(name);
attr.value = attr.nodeValue = "" + value;
this.setAttributeNode(attr)
},
removeAttribute : function(name){
var attr = this.getAttributeNode(name)
attr && this.removeAttributeNode(attr);
},

appendChild:function(newChild){
if(newChild.nodeType === DOCUMENT_FRAGMENT_NODE){
return this.insertBefore(newChild,null);
}else{
return _appendSingleChild(this,newChild);
}
},
setAttributeNode : function(newAttr){
return this.attributes.setNamedItem(newAttr);
},
setAttributeNodeNS : function(newAttr){
return this.attributes.setNamedItemNS(newAttr);
},
removeAttributeNode : function(oldAttr){

return this.attributes.removeNamedItem(oldAttr.nodeName);
},

removeAttributeNS : function(namespaceURI, localName){
var old = this.getAttributeNodeNS(namespaceURI, localName);
old && this.removeAttributeNode(old);
},
hasAttributeNS : function(namespaceURI, localName){
return this.getAttributeNodeNS(namespaceURI, localName)!=null;
},
getAttributeNS : function(namespaceURI, localName){
var attr = this.getAttributeNodeNS(namespaceURI, localName);
return attr && attr.value || '';
},
setAttributeNS : function(namespaceURI, qualifiedName, value){
var attr = this.ownerDocument.createAttributeNS(namespaceURI, qualifiedName);
attr.value = attr.nodeValue = "" + value;
this.setAttributeNode(attr)
},
getAttributeNodeNS : function(namespaceURI, localName){
return this.attributes.getNamedItemNS(namespaceURI, localName);
},
getElementsByTagName : function(tagName){
return new LiveNodeList(this,function(base){
var ls = [];
_visitNode(base,function(node){
if(node !== base && node.nodeType == ELEMENT_NODE && (tagName === '*' || node.tagName == tagName)){
ls.push(node);
}
});
return ls;
});
},
getElementsByTagNameNS : function(namespaceURI, localName){
return new LiveNodeList(this,function(base){
var ls = [];
_visitNode(base,function(node){
if(node !== base && node.nodeType === ELEMENT_NODE && (namespaceURI === '*' || node.namespaceURI === namespaceURI) && (localName === '*' || node.localName == localName)){
ls.push(node);
}
});
return ls;
});
}
};
Document.prototype.getElementsByTagName = Element.prototype.getElementsByTagName;
Document.prototype.getElementsByTagNameNS = Element.prototype.getElementsByTagNameNS;
_extends(Element,Node);
function Attr() {
};
Attr.prototype.nodeType = ATTRIBUTE_NODE;
_extends(Attr,Node);
function CharacterData() {
};
CharacterData.prototype = {
data : '',
substringData : function(offset, count) {
return this.data.substring(offset, offset+count);
},
appendData: function(text) {
text = this.data+text;
this.nodeValue = this.data = text;
this.length = text.length;
},
insertData: function(offset,text) {
this.replaceData(offset,0,text);
},
appendChild:function(newChild){
throw new Error(ExceptionMessage[HIERARCHY_REQUEST_ERR])
},
deleteData: function(offset, count) {
this.replaceData(offset,count,"");
},
replaceData: function(offset, count, text) {
var start = this.data.substring(0,offset);
var end = this.data.substring(offset+count);
text = start + text + end;
this.nodeValue = this.data = text;
this.length = text.length;
}
}
_extends(CharacterData,Node);
function Text() {
};
Text.prototype = {
nodeName : "#text",
nodeType : TEXT_NODE,
splitText : function(offset) {
var text = this.data;
var newText = text.substring(offset);
text = text.substring(0, offset);
this.data = this.nodeValue = text;
this.length = text.length;
var newNode = this.ownerDocument.createTextNode(newText);
if(this.parentNode){
this.parentNode.insertBefore(newNode, this.nextSibling);
}
return newNode;
}
}
_extends(Text,CharacterData);
function Comment() {
};
Comment.prototype = {
nodeName : "#comment",
nodeType : COMMENT_NODE
}
_extends(Comment,CharacterData);
function CDATASection() {
};
CDATASection.prototype = {
nodeName : "#cdata-section",
nodeType : CDATA_SECTION_NODE
}
_extends(CDATASection,CharacterData);
function DocumentType() {
};
DocumentType.prototype.nodeType = DOCUMENT_TYPE_NODE;
_extends(DocumentType,Node);
function Notation() {
};
Notation.prototype.nodeType = NOTATION_NODE;
_extends(Notation,Node);
function Entity() {
};
Entity.prototype.nodeType = ENTITY_NODE;
_extends(Entity,Node);
function EntityReference() {
};
EntityReference.prototype.nodeType = ENTITY_REFERENCE_NODE;
_extends(EntityReference,Node);
function DocumentFragment() {
};
DocumentFragment.prototype.nodeName =	"#document-fragment";
DocumentFragment.prototype.nodeType =	DOCUMENT_FRAGMENT_NODE;
_extends(DocumentFragment,Node);
function ProcessingInstruction() {
}
ProcessingInstruction.prototype.nodeType = PROCESSING_INSTRUCTION_NODE;
_extends(ProcessingInstruction,Node);
function XMLSerializer(){}
XMLSerializer.prototype.serializeToString = function(node,isHtml,nodeFilter){
return nodeSerializeToString.call(node,isHtml,nodeFilter);
}
Node.prototype.toString = nodeSerializeToString;
function nodeSerializeToString(isHtml,nodeFilter){
var buf = [];
var refNode = this.nodeType == 9?this.documentElement:this;
var prefix = refNode.prefix;
var uri = refNode.namespaceURI;
if(uri && prefix == null){

var prefix = refNode.lookupPrefix(uri);
if(prefix == null){

var visibleNamespaces=[
{namespace:uri,prefix:null}

]
}
}
serializeToString(this,buf,isHtml,nodeFilter,visibleNamespaces);

return buf.join('');
}
function needNamespaceDefine(node,isHTML, visibleNamespaces) {
var prefix = node.prefix||'';
var uri = node.namespaceURI;
if (!prefix && !uri){
return false;
}
if (prefix === "xml" && uri === "http://www.w3.org/XML/1998/namespace" 
|| uri == 'http://www.w3.org/2000/xmlns/'){
return false;
}
var i = visibleNamespaces.length 

while (i--) {
var ns = visibleNamespaces[i];


if (ns.prefix == prefix){
return ns.namespace != uri;
}
}






return true;
}
function serializeToString(node,buf,isHTML,nodeFilter,visibleNamespaces){
if(nodeFilter){
node = nodeFilter(node);
if(node){
if(typeof node == 'string'){
buf.push(node);
return;
}
}else{
return;
}

}
switch(node.nodeType){
case ELEMENT_NODE:
if (!visibleNamespaces) visibleNamespaces = [];
var startVisibleNamespaces = visibleNamespaces.length;
var attrs = node.attributes;
var len = attrs.length;
var child = node.firstChild;
var nodeName = node.tagName;
isHTML = (htmlns === node.namespaceURI) ||isHTML 
buf.push('<',nodeName);
for(var i=0;i<len;i++){

var attr = attrs.item(i);
if (attr.prefix == 'xmlns') {
visibleNamespaces.push({ prefix: attr.localName, namespace: attr.value });
}else if(attr.nodeName == 'xmlns'){
visibleNamespaces.push({ prefix: '', namespace: attr.value });
}
}
for(var i=0;i<len;i++){
var attr = attrs.item(i);
if (needNamespaceDefine(attr,isHTML, visibleNamespaces)) {
var prefix = attr.prefix||'';
var uri = attr.namespaceURI;
var ns = prefix ? ' xmlns:' + prefix : " xmlns";
buf.push(ns, '="' , uri , '"');
visibleNamespaces.push({ prefix: prefix, namespace:uri });
}
serializeToString(attr,buf,isHTML,nodeFilter,visibleNamespaces);
}

if (needNamespaceDefine(node,isHTML, visibleNamespaces)) {
var prefix = node.prefix||'';
var uri = node.namespaceURI;
var ns = prefix ? ' xmlns:' + prefix : " xmlns";
buf.push(ns, '="' , uri , '"');
visibleNamespaces.push({ prefix: prefix, namespace:uri });
}
if(child || isHTML && !/^(?:meta|link|img|br|hr|input)$/i.test(nodeName)){
buf.push('>');

if(isHTML && /^script$/i.test(nodeName)){
while(child){
if(child.data){
buf.push(child.data);
}else{
serializeToString(child,buf,isHTML,nodeFilter,visibleNamespaces);
}
child = child.nextSibling;
}
}else
{
while(child){
serializeToString(child,buf,isHTML,nodeFilter,visibleNamespaces);
child = child.nextSibling;
}
}
buf.push('</',nodeName,'>');
}else{
buf.push('/>');
}


return;
case DOCUMENT_NODE:
case DOCUMENT_FRAGMENT_NODE:
var child = node.firstChild;
while(child){
serializeToString(child,buf,isHTML,nodeFilter,visibleNamespaces);
child = child.nextSibling;
}
return;
case ATTRIBUTE_NODE:
return buf.push(' ',node.name,'="',node.value.replace(/[<&"]/g,_xmlEncoder),'"');
case TEXT_NODE:
return buf.push(node.data.replace(/[<&]/g,_xmlEncoder));
case CDATA_SECTION_NODE:
return buf.push( '<![CDATA[',node.data,']]>');
case COMMENT_NODE:
return buf.push( "<!--",node.data,"-->");
case DOCUMENT_TYPE_NODE:
var pubid = node.publicId;
var sysid = node.systemId;
buf.push('<!DOCTYPE ',node.name);
if(pubid){
buf.push(' PUBLIC "',pubid);
if (sysid && sysid!='.') {
buf.push( '" "',sysid);
}
buf.push('">');
}else if(sysid && sysid!='.'){
buf.push(' SYSTEM "',sysid,'">');
}else{
var sub = node.internalSubset;
if(sub){
buf.push(" [",sub,"]");
}
buf.push(">");
}
return;
case PROCESSING_INSTRUCTION_NODE:
return buf.push( "<?",node.target," ",node.data,"?>");
case ENTITY_REFERENCE_NODE:
return buf.push( '&',node.nodeName,';');


default:
buf.push('??',node.nodeName);
}
}
function importNode(doc,node,deep){
var node2;
switch (node.nodeType) {
case ELEMENT_NODE:
node2 = node.cloneNode(false);
node2.ownerDocument = doc;





case DOCUMENT_FRAGMENT_NODE:
break;
case ATTRIBUTE_NODE:
deep = true;
break;














}
if(!node2){
node2 = node.cloneNode(false);
}
node2.ownerDocument = doc;
node2.parentNode = null;
if(deep){
var child = node.firstChild;
while(child){
node2.appendChild(importNode(doc,child,deep));
child = child.nextSibling;
}
}
return node2;
}



function cloneNode(doc,node,deep){
var node2 = new node.constructor();
for(var n in node){
var v = node[n];
if(typeof v != 'object' ){
if(v != node2[n]){
node2[n] = v;
}
}
}
if(node.childNodes){
node2.childNodes = new NodeList();
}
node2.ownerDocument = doc;
switch (node2.nodeType) {
case ELEMENT_NODE:
var attrs	= node.attributes;
var attrs2	= node2.attributes = new NamedNodeMap();
var len = attrs.length
attrs2._ownerElement = node2;
for(var i=0;i<len;i++){
node2.setAttributeNode(cloneNode(doc,attrs.item(i),true));
}
break;;
case ATTRIBUTE_NODE:
deep = true;
}
if(deep){
var child = node.firstChild;
while(child){
node2.appendChild(cloneNode(doc,child,deep));
child = child.nextSibling;
}
}
return node2;
}
function __set__(object,key,value){
object[key] = value
}

try{
if(Object.defineProperty){
Object.defineProperty(LiveNodeList.prototype,'length',{
get:function(){
_updateLiveList(this);
return this.$$length;
}
});
Object.defineProperty(Node.prototype,'textContent',{
get:function(){
return getTextContent(this);
},
set:function(data){
switch(this.nodeType){
case ELEMENT_NODE:
case DOCUMENT_FRAGMENT_NODE:
while(this.firstChild){
this.removeChild(this.firstChild);
}
if(data || String(data)){
this.appendChild(this.ownerDocument.createTextNode(data));
}
break;
default:

this.data = data;
this.value = data;
this.nodeValue = data;
}
}
})
function getTextContent(node){
switch(node.nodeType){
case ELEMENT_NODE:
case DOCUMENT_FRAGMENT_NODE:
var buf = [];
node = node.firstChild;
while(node){
if(node.nodeType!==7 && node.nodeType !==8){
buf.push(getTextContent(node));
}
node = node.nextSibling;
}
return buf.join('');
default:
return node.nodeValue;
}
}
__set__ = function(object,key,value){

object['$$'+key] = value
}
}
}catch(e){
}

exports.DOMImplementation = DOMImplementation;
exports.XMLSerializer = XMLSerializer;

}
,
function(exports,require){
exports.findELEnd=findELEnd;

function findELEnd(text, elQuteBegin) {
elQuteBegin = elQuteBegin||0;
var length = text.length;
var next = elQuteBegin + 1;
if (next >= length) {
return -1;
}
var stringChar = 0;
var depth = 0;
do {
var c = text.charAt(next);
switch (c) {
case '\\':
next++;
break;
case '\'':
case '"':
if (stringChar == c) {
stringChar = 0;
} else if (stringChar == 0) {
stringChar = c;
}
break;
case '{':
case '[':
case '(':
if (stringChar == 0) {
depth++;
}
break;
case '}':
case ']':
case ')':
if (stringChar == 0) {
depth--;
if (depth < 0) {
return next;
}
}
break;
case '/':
if (stringChar == 0) {
var regExp = isRegExp(text, elQuteBegin, next);
if (regExp) {
var end = findRegExpEnd(text, next);
if(end >0){
next = end;
}else{
console.error("无效状态");
}
}
}
}
} while (++next < length);
return -1;
}
function isRegExp(text, elQuteBegin,
regExpStart) {
for (var i = regExpStart-1; i > elQuteBegin; i--) {
var pc = text.charAt(i);
if (!/\s/.test(pc)) {
if (/[\w\$]/.test(pc)) {
return false;
} else {
switch (pc) {
case ']':
case ')':
case '}':
return false;







default:
return true;
}
}
}
}

return true;
}
function findRegExpEnd( text, regExpStart) {
var length = text.length;
var depth = 0;
for (regExpStart++; regExpStart < length; regExpStart++) {
var rc = text.charAt(regExpStart);
if (rc == '[') {
depth = 1;
} else if (rc == ']') {
depth = 0;
} else if (rc == '\\') {
regExpStart++;
} else if (depth == 0 && rc == '/') {
while (regExpStart < length) {
rc = text.charAt(regExpStart++);
switch (rc) {
case 'g':
case 'i':
case 'm':
break;
default:
return regExpStart - 1;
}
}
}
}
return -1;
}
}
,
function(exports,require){exports.parseDefName = parseDefName;
exports.findLiteParamMap = findLiteParamMap;
exports.parseChildRemoveAttr = parseChildRemoveAttr;
exports.setNodeURI = setNodeURI;
exports.appendForStart = appendForStart;
var getLiteTagInfo=require(8).getLiteTagInfo;
function parseDefName(name){
var n = name;
var i = n.indexOf('(');
var defaults = [];
var params = [];
if(i>0){
var args = n.substring(i+1);
args = args.replace(/^\s+|\)\s*$/g,'')
n = toid(n.substring(0,i));
i = 0;
while(args){
i = args.indexOf(',',i);
if(i>0){
var arg = args.substring(0,i);
try{
new Function(arg);
args = args.substring(i+1).replace(/^\s+|\s+$/g,'');
i=0;
}catch(e){
i++;
continue;
}
}else{
arg = args;
args = null;
try{
new Function(arg);
}catch(e){
console.error("函数定义中参数表语法错误:"+arg+name,e);
throw e;
}
}
var p = arg.indexOf('=',i);
if(p>0){
params.push(toid(arg.substring(0,p)));
defaults.push(JSON.parse(arg.substring(p+1)));
}else{
if(defaults.length){
var msg = "函数定义中参数表语法错误:默认参数值能出现在参数表最后:"+name;
console.error(msg);
throw new Error(msg);
}
params.push(toid(arg));
}
}
return {"name":n,"params":params,"defaults":defaults};
}else{
return {"name":n}
}
}
function findLiteParamMap(value){
var result = {};
while(value){
var match = value.match(/^\s*([\w\$\_]+|'[^']*'|"[^"]*")\s*(?:[\:=]\s*([\s\S]+))\s*$/);
if(!match){
throw console.error("非法参数信息",value);
return null;
}
value =match[2];
var key = match[1].replace(/^['"]|['"]$/g,'');
var p = findStatementEnd(value);
var statment = value.substring(0,p);
result[key] = statment;
value = value.substring(p+1);
}
return result;
}

function findStatementEnd(text){
var end = 0;
do{
var end1 = text.indexOf(',',end + 1);
var end2 = text.indexOf(';',end + 1);
if(end2>0 && end1>0){
end = Math.min(end1 , end2);
}else{
end = Math.max(end1,end2);
}
if(end<=0){
break;
}
var code = text.substring(0,end);
try{
new Function(code);
return end;
}catch(e){
end = end+1
}
}while(end>=0)
return text.length;
}
function setNodeURI(context,node){
if(!node.nodeType){
if(node.length){
node = node.item(0);
}
}
var doc = node.nodeType == 9?node:node.ownerDocument;
if(doc){
var uri = doc.documentURI
if(/^lite:\//.test(uri)){
context.setCurrentURI(context.createURI(uri));
}else if(uri){
var info = getLiteTagInfo(doc.documentElement);

var i = info && info.indexOf('|@');
if(i>0){
uri = info.substring(i+2);
}
context.setCurrentURI(context.createURI(uri));

}
}
}
function parseChildRemoveAttr(context,node,ignoreSpace){
if(node.nodeType == 1){
var child = node.firstChild;
if(ignoreSpace){
while(child){
if(child.nodeType != 3 || String(child.data).replace(/\s+/g,'')){
context.parse(child)
}
child = child.nextSibling;
}
}else{
while(child){
context.parse(child)
child = child.nextSibling;
}
}
}else if(node.nodeType == 2){


var el = node.ownerElement||node.selectSingleNode('..');

el.removeAttributeNode(node);
context.parse(el);
}else {
context.parse(node)
}
}

var FOR_PATTERN = /\s*([\$\w_]+)\s*(?:\(\s*([\w\$_]+)\))?\s*(?:\:|in)([\s\S]*)/;
function appendForStart(context,var_,list,status_){

if(!list){
var match = var_.match(FOR_PATTERN);
if(!match){
throw console.error("非法 for 循环信息",value);
}
var var_ = match[1];
var status_ =match[2];
var list =match[3];
}
var be = _splitList(list);
if(be.length==2){
var begin = be[0];
var end = be[1];
list = "Math.abs("+begin+'-'+end+")+1";
context.appendFor(var_,list,status_||null);
context.appendVar(var_,var_+'+'+begin+"-1");
}else if(be.length ==1){
context.appendFor(var_,list,status_||null);
}else{
console.error("for表达式无效："+list);
throw new Error('for 表达式无效：list='+list+';var='+var_);
}
}
function _splitList(list){
try{
new Function("return "+list.replace(/\.\./g,'.%%.'));
return [list];
}catch(e){
var dd= 0
while(true){
dd = list.indexOf('..',dd+1);
if(dd>0){
try{
var begin = list.substring(0,dd);
var end = list.substring(dd+2);
new Function("return "+begin+'-'+end);
var begin2 = begin.replace(/^\s*\[/,'');
if(begin2 != begin){
try{
new Function("return "+begin);
begin2 = begin;
}catch(e){
}
}
if(begin2 != begin){
end = end.replace(/\]\s*$/,'');
console.debug("[start,last] 语法 不是通用表达式，只能在for循环中使用。",list);
return [begin2,end];
}else{
console.warn("range for 表达式(非通用表达式)推荐模式为：[start,last]，您提供的表达式为"+list);
return [begin,end];
}
}catch(e){
}

}else{
return [];
}
}
}
}
function toid(n){
n = n.replace(/^\s+|\s+$/g,'');
try{
new Function("return "+n);
}catch(e){
console.error("无效id:"+n,e);
throw e;
}
return n;
}
}
,
function(exports,require){
var uncompressed = /^[\t ]{2}|^\s*\/\/|\/\**[\r\n]/m;
function tokenCompress(source,file,root){
source = String(source).replace(/\r\n?/g,'\n');
if(source.search(uncompressed)<0){
return source;
}
var ps = partitionJavaScript(source,file,root);
var result = [];
for(var i =0;i<ps.length;i++){
var item = ps[i];
switch(item.charAt()){
case '\'':
case '\"':
result.push(item);
break;
case '/':

var stat = item.match(/^\/(?:(\*\s*@)|\/|\*)/);
if(!stat || stat[1]){
result.push(item);
}
break;
default:


result.push(item.replace(/(\n)+|([^\S\r\n])+/gm,'$1$2').replace(/(?:([\r\n])+\s*)+/g,'$1'));
}
}
return result.join('');
}
var compressedCache = []
function compressJS(source,file,root){
source = source.replace(/^\/\*[\s\S]*?\*\/\s*/g,'')
var i = compressedCache.indexOf(source);
if(i>=0){
if(i%2 == 0){
var kv = compressedCache.splice(i,2)
compressedCache.push(kv[0],kv[1]);
return kv[1];
}else{
return source;
}
};
var result = source;
var sample = source.slice(source.length	/10,source.length/1.1);

if(sample.length < 200 || sample.match(uncompressed)){
try{
result= tokenCompress(source,file,root);
}catch(e){
result= tokenCompress('this.x='+source,file,root).replace(/^this.x=|(});$/g,'$1') ;
}
}
compressedCache.push(source,result);
if(compressedCache.length>64){
compressedCache.shift();
compressedCache.shift();
}
return result;
}
var TYPE_COMMENT=0, TYPE_SOURCE =1, TYPE_STRING =2, TYPE_REGEXP=3;

function partitionJavaScript(source,file,root){

var regexp = /'(?:\\.|[^'])*'|"(?:\\.|[^"])*"|\/\/.*|\/\*[\s\S]*?\*\/|\/(?=[^*\/].*\/(?:[img]*\b|[^\w]))|<(?=(?:[A-Za-z_][\w_\-\.]*(?:\:[\w\-\.]*)?)(?:\s*\/?>|\s+\w))/i;
var m,result = [],latestType=-1;
source = source.replace(/\r\n|\r/g,'\n');
function append(token,type){

if(token){
if(latestType == type){
result[result.length-1]+=token;
}else{
result.push(token);
latestType = type;
}
}
}
function appendXML(xml){
var preIndex = result.length-1;
var prev = result[preIndex];

var preFunctionMatch = prev.match(/(?:(\([\w\s,]*\))(\{\s*(?:return\s*)?))?$/);
if(preFunctionMatch){
var params = preFunctionMatch[1];
var functionQute = preFunctionMatch[2];

}
var args = params&&params.replace(/[\s()]/g,'').split(',')||[];
var fn = parseTemplate(xml,file,{
root:root,
params:args||[]
})
var fnCode = String(fn).replace(/^\s+|\s+$/g,'');
if(functionQute){
prev = prev.slice(0,prev.length-preFunctionMatch[0].length+1);
result[preIndex] = prev+fnCode.replace(/^[^(]+.|\}[^}]*$/g,'')
}else{
var m = fnCode.match(/^function\([\w\s,]*\)\{\s*return/);
if(m){
result[preIndex] = prev+fnCode.substring(m[0].length).replace(/;?\s*\}[^}]*$/,'')
}else{
result[preIndex] = prev+'('+fnCode+')()';
}
}
}

regexp.lastIndex = 0;
while(m = regexp.exec(source)){

if(m){
var index = m.index;
var m = m[0];
var xml = m == '<'

if(m == '/' || xml){
append(source.substring(0,index),TYPE_SOURCE)
var m2 = (xml ?findXML:findExp)(result,source.substring(index));

if(m2){
m = m2;
if(xml){
appendXML(m);
}else{
append(m,TYPE_REGEXP)
}
}else{

append(m.replace(/^\//,'\t\/'),TYPE_SOURCE);
}
}else{
append(source.substring(0,index),TYPE_SOURCE)
switch(m.charAt()){
case '\'':
case '\"':
append(m,TYPE_STRING);
break;
case '/':
var m2 = m.charAt(1);
if(m2=='*' || m2 == '/'){
append(m,TYPE_COMMENT);
break;
}
default:
append(m,TYPE_SOURCE);
}
}
source = source.substring(m.length+index);
}else{
break;
}
}
append(source,TYPE_SOURCE);
return result;
}

function findXML(result,source){
var tag = source.match(/^<([a-z_][\w_\-\.]*(?:\:[a-z_][\w_\-\.]*)?)(?:\s*[\/>]|\s+[\w_])/i);
if(tag){
tag = tag[1];
tag = tag.replace(/\.\-/g,'\\$&');
var reg = new RegExp('<(/)?'+tag,'g');
var depth = 0;
reg.lastIndex = 0;
while(tag = reg.exec(source)){
if(tag[1]){
if(--depth == 0){
return source.substring(0,tag.index+tag[0].length+1)
}else if(depth<0){
return null;
}
}else{
depth++;
}
}
}else{
return null;
}
}
function parseTemplate(xml,file,options){
var m = xml.match(/^([\w\-\/\.]+)(#.*)?$/)
if(m){
var attr = m[2];

var buf =["<c:include path='",m[1],"' "];
if(attr && attr.length>1){
buf.push('selector="',attr.substr(1).replace(/["]/g,'&#34;'),'"/>')
}else{
buf.push('/>')
}
xml = buf.join('')
}

var parser = new (require(22).DOMParser)({
locator:{systemId:file||options.root},
xmlns:{
c:'http://www.xidea.org/lite/core',
h:'http://www.xidea.org/lite/html-ext'
}
});
xml = parser.parseFromString(xml,'text/html');
return require(42).parseLite(xml,options);
}

function findExp(result,source){
var i = result.length;
while(i--){
var line = result[i];

if(!/^\/[\/*]|^\s+$/.test(line)){
line = line.replace(/\s+$/,'');
if(/^['"]|^\/.+\/$/.test(line)){
break;
}else if(/\b(?:new|instanceof|typeof)$/.test(line)){
return findExpSource(source);
}else if(/(?:[)\]}]|[\w_]|--|\+\+)$/.test(line)){
break;
}else{
return findExpSource(source);
}
}
}
}
function findExpSource(text){
var depth=0,c,start = 1;
while(c = text.charAt(start++)){
if(c =='\n' || c == '\r'){

return;
}
if(c=='['){
depth = 1;
}else if(c==']'){
depth = 0;
}else if (c == '\\') {
start++;
}else if(depth == 0 && c == '/'){
outer:
while(c = text.charAt(start++)){
switch(c){
case 'g':
case 'i':
case 'm':
break;
default:
if(/\w/.test(c)){

return null;
}else{
break outer;
}
}
}

text = text.substring(0,start-1);

return text;
}
}

}
if(typeof require == 'function'){
exports.partitionJavaScript=partitionJavaScript;
exports.compressJS=compressJS;
}
}
,
function(exports,require){

function JSONTokenizer(value){
this.value = value.replace(/^\s+|\s+$/g,'');
this.start = 0;
this.end = this.value.length;
}
JSONTokenizer.prototype = {
parse : function() {
this.skipComment();
var c = this.value.charAt(this.start);
if (c == '"') {
return this.findString();
} else if (c == '-' || c >= '0' && c <= '9') {
return this.findNumber();
} else if (c == '[') {
return this.findList();
} else if (c == '{') {
return this.findMap();
} else {
var key = this.findId();
if ("true".equals(key)) {
return Boolean.TRUE;
} else if ("false".equals(key)) {
return Boolean.FALSE;
} else if ("null".equals(key)) {
return null;
} else {
throw new Error("语法错误:" + this.value + "@"
+ this.start);
}
}
},
findMap : function() {
this.start++;
this.skipComment();
var result = {};
while (true) {

var key = this.parse();
this.skipComment();
var c = this.value.charAt(this.start++);
if (c != ':') {
throw new Error("错误对象语法:" + this.value + "@"
+ this.start);
}
var valueObject = this.parse();
this.skipComment();
c = this.value.charAt(this.start++);
if (c == '}') {
result[key]= valueObject;
return result;
} else if (c != ',') {
throw new Error("错误对象语法:" + this.value + "@"
+ this.start);
} else {
result.put(key, valueObject);
}
}
},
findList:function() {
var result = [];

this.start++;
this.skipComment();
if (this.value.charAt(this.start) == ']') {
this.start++;
return result;
} else {
result.push(this.parse());
}
while (true) {
this.skipComment();
var c = this.value.charAt(this.start++);
if (c == ']') {
return result;
} else if (c == ',') {
this.skipComment();
result.push(this.parse());
} else {
throw new Error("错误数组语法:" + this.value + "@"
+ this.start);
}
}
},
findNumber:function() {
var i = this.start;
var isFloatingPoint = false;
var c = this.value.charAt(i++);
if (c == '-') {
c = this.value.charAt(i++);
}
if (c == '0') {
if (i < this.end) {
return this.parseZero();
} else {
this.start = i;
return 0;
}
}
var ivalue = c - '0';
while (i < this.end) {
c = this.value.charAt(i++);
if (c >= '0' && c <= '9') {
ivalue = (ivalue * 10) + (c - '0');
} else {
break;
}
}
if (c == '.') {
c = this.value.charAt(i++);
while (c >= '0' && c <= '9') {
isFloatingPoint = true;
if (i < this.end) {
c = this.value.charAt(i++);
} else {
break;
}
}
if (!isFloatingPoint) {


this.start = i - 2;
return ivalue;
}
}
if (c == 'E' || c == 'e') {
isFloatingPoint = true;
c = this.value.charAt(i++);
if (c == '+' || c == '-') {
c = this.value.charAt(i++);
}
while (c >= '0' && c <= '9') {
if (i < this.end) {
c = this.value.charAt(i++);
} else {
break;
}
}
} else {
c = this.value.charAt(i - 1);
if (c < '0' || c > '9') {
i--;
}
}
if (isFloatingPoint) {
return this.value.substring(this.start, this.start = i)*1;
} else {
this.start = i;
return ivalue;
}
},
parseZero: function(){
var value = this.value.substr(this.start);
value = value.replace(/([+-]?0(?:x[0-9a-f]+|\.?[0-9]*))[\s\S]*/i,'$1');
this.start += value.length;

if(value.indexOf('.')<0){
return parseInt(value);
}
return parseFloat(value);
},
findId:function() {
var p = this.start;
if (/[\w\$_]/.test(this.value.charAt(p++))) {
while (p < this.end) {
if (!/[\w\$_]/.test(this.value.charAt(p))) {
break;
}
p++;
}
return (this.value.substring(this.start, this.start = p));
}
throw new Error("无效id");
},

findString:function() {
var quoteChar = this.value.charAt(this.start++);
var buf = [];
while (this.start < this.end) {
var c = this.value.charAt(this.start++);
switch (c) {
case '\\':
var c2 = this.value.charAt(this.start++);
switch (c2) {
case 'b':
buf.push('\b');
break;
case 'f':
buf.push('\f');
break;
case 'n':
buf.push('\n');
break;
case 'r':
buf.push('\r');
break;
case 't':
buf.push('\t');
break;
case 'v':
buf.push(0xb);
break; 
case ' ':
buf.push(' ');
break;
case '\\':
case '\/':
buf.push(c2);
break;
case '\'':
buf.push('\'');
break;
case '\"':
buf.push('"');
break;
case 'u':
var c = this.value.substring(
this.start, this.start + 4);
c = parseInt(c, 16);
buf.push(String.fromCharCode(c));
this.start += 4;
break;
case 'x':
var c = this.value.substring(this.start, this.start + 2);
c = parseInt(c, 16);
buf.push(String.fromCharCode(c));
this.start += 2;
break;
default:
buf.push(c);
buf.push(c2);
}
break;
case '"':
case '\'':
if (c == quoteChar) {
return (buf.join(''));
}
default:
buf.push(c);
}
}
throw new Error("未结束字符串:" + this.value
+ "@" + this.start);
},
skipComment:function() {
while (true) {
while (this.start < this.end) {
var c = this.value.charAt(this.start);
if (c == ' ' || c =='\t') {
this.start++;
}else{
break;
}
}
if (this.start < this.end && this.value.charAt(this.start) == '/') {
this.start++;
var next = this.value.charAt(this.start++);
if (next == '/') {
var end1 = this.value.indexOf('\n', this.start);
var end2 = this.value.indexOf('\r', this.start);
var cend = Math.min(end1, end2);
if (cend < 0) {
cend = Math.max(end1, end2);
}
if (cend > 0) {
this.start = cend;
} else {
this.start = this.end;
}
} else if (next == '*') {
var cend = this.value.indexOf("*/", this.start);
if (cend > 0) {
this.start = cend + 2;
} else {
throw new Error("未結束注釋:" + this.value
+ "@" + this.start);
}
}
} else {
break;
}
}
},
skipSpace:function(nextChar) {
while (this.start < this.end) {
var c = this.value.charAt(this.start);
if (c == ' ' || c =='\t' || c == '\r' || c == '\n') {
this.start++;
}else{
break;
}
}
if (nextChar > '\x00' && this.start < this.end) {
var next = this.value.charAt(this.start);
if (nextChar == next) {
return true;
}
}
return false;
}
}



if(typeof require == 'function'){
exports.JSONTokenizer=JSONTokenizer;
}
}
,
function(exports,require){

function parseLite(data,config){
var path = data && data.documentURI;
var root = config&&config.root || path&&path.replace(/[^\/\\]+$/,'');
var parseContext = new ParseContext(root && new ParseConfig(root));
path && parseContext.setCurrentURI(path)
data = parseContext.loadXML(data);
parseContext.parse(data);
try{
if(config instanceof Array){
config = {params:config} 
}
var translator = new JSTranslator();

var code = translator.translate(parseContext.toList(),config);

data = new Function('return '+code).apply();
data.toString=function(){
return code;
}
return data;
}catch(e){
console.error("translate error",e,code)
throw e;
}
}
if(typeof require == 'function'){
exports.parseLite=parseLite;
exports.LiteEngine=require(43).LiteEngine;
var ParseConfig=require(15).ParseConfig;
var JSTranslator=require(1).JSTranslator;
var ParseContext=require(0).ParseContext;
}
}
,
function(exports,require,module,__filename){var __dirname= __filename.replace(/[^\/]+$/,"");var Template = require(2).Template
exports.getTemplateId = getTemplateId;
exports.LiteEngine = LiteEngine;
function LiteEngine(root,options){
options = options || {}
this.litecache = options.litecache;
this.released = options.released;
root = require(44).resolve(root || './')
root = root.replace(/[\\\/]*$/,'/');
this.root = root;
this.templateMap = {};
this.renderTask = {};
if(!this.released){
this.compiler = initCompiler(this, options.configurator);
}
}

function initCompiler(engine,configurator){
try{
if(configurator instanceof Function){
throw new Error();
}

var root = engine.root;
var configRootKey = require(46).configRootKey
var args = [configRootKey,root]
if(configurator){
args.push('-configurator',configurator);
}
var compiler = require(45).fork(__dirname + '/process.js',args);
compiler.on('message', function(result){

engine.onChange(result.path,result.code,result.config)
}); 
return compiler;
}catch(e){
var setupCompiler = require(46).setupCompiler;
var sender = setupCompiler(root,function(result){
var action = result.action;
if(action == 'remove' || action == 'add' || action=='error'){
engine.onChange(result.path,result.code,result.config)
}
},configurator);
return {
send:sender
}
}
}
LiteEngine.prototype.requestCompile = function(path){
if(this.released){
var id = getTemplateId(path);
var file = require(44).join(this.litecache,id+'.js');
this.onChange(path,null,{liteFile:file})
}else{
this.compiler.send(path);
}
}
LiteEngine.prototype.onChange = function(path,code,config) {

if(config&&config.liteFile){
try{
var tpl = require(config.liteFile);
tpl = new Template(tpl.template,tpl.config);
}catch(e){
console.error(e)
code = "function(context,out){var err = 'template:"+config.liteFile+" not found!!';console.error(err);out.push(err);return out.join('')}";
var tpl = new Template(code,config);
}
}else if(code && config.error == null){

var id = getTemplateId(path);
var file = this.updateLitecache(id,code,config)
try{
var tpl = require(file);
tpl = new Template(tpl.template || code,tpl.config);
}catch(e){
console.error(e);
var tpl = new Template(code,config);
}
this.templateMap[path] = tpl; 
}else{
delete this.templateMap[path];

console.info('clear template cache:' ,path);
return;
}
var task = this.renderTask[path];
if(task){
delete this.renderTask[path];
for(var i=0;i<task.length;i++){
var args = task[i];
args[0] = tpl;
doRender.apply(null,args)
}
}
}
LiteEngine.prototype.updateLitecache = function(id,code,config){
var litecache = this.litecache;
var fs = require(4);
if(litecache && fs.existsSync(litecache)){
var file = require(44).join(litecache,id+'.js');
if(code){
var source = ['exports.template=',code,';\nexports.config = ',JSON.stringify(config)].join('')
fs.writeFileSync(file,source);
return file;
}else{
fs.unlinkFileSync(file)
}
}
}
LiteEngine.prototype.render=function(path,model,req,response){
var cookie = String(req.headers.cookie);
var debug = cookie.replace(/(?:^|&[\s\S]*;\s*)LITE_DEBUG=(\w+)[\s\S]*$/,'$1');
debug = debug == cookie?false:debug;
if(debug=='model'){
response.end(JSON.stringify(model));
}else if(debug=='source'){
require(4).readFile(require(44).resolve(this.root ,path.replace(/^[\\\/]/,'')), "binary", function(err, file) { 
if(err) {
response.writeHead(404, {"Content-Type": "text/plain"}); 
response.end(err + "\n"); 
}else{
response.writeHead(200, {"Content-Type": 'text/plain;charset=utf8'}); 
response.end(file, "binary"); 
} 
});
}else{
var tpl = this.templateMap[path];
if(tpl){
doRender(tpl,model,response);
}else{
(this.renderTask[path] || (this.renderTask[path] =[])).push([path,model,response]);
this.requestCompile(path);
}
}
}
function doRender(tpl,model,response){
if(!response.headersSent){



if(!response.statusCode ){
response.statusCode = 200;
}
if(response.getHeader('content-type') == null){
response.setHeader('content-type', tpl.contentType||'text/html;charset=utf-8')
}
}

try{
tpl.render(model,response);
}catch(e){
var rtv = '<pre>'+require(5).inspect(e,true)+'\n\n'+(e.message +e.stack);
response.end(rtv);
throw e;
}
}
function getTemplateId(path){

return path.slice(1).replace(/[^\w\_]/g,'_');
}
}
,
function(exports,require,module){console.log("read module err!!!path\nError: ENOENT: no such file or directory, open 'path'")
}
,
function(exports,require,module){console.log("read module err!!!child_process\nError: ENOENT: no such file or directory, open 'child_process'")
}
,
function(exports,require){var configRootKey = '-lite-engine-child-process-root';
exports.configRootKey = configRootKey

var argv = process.argv;
var isChild = argv[2]==configRootKey;
if(isChild){

var root = argv[3].replace(/\/?$/,'/');
if(argv[4] == '-configurator' && argv[5]){
var configurator = argv[5];
}

var compile = setupCompiler(root,function(cmd){

process.send(cmd)
},configurator);
process.on('message', function(path){
compile(path);
});
}
function setupCompiler(root,callback,configurator){
var fs = require(4);

var templateMap = {
}

var resourceMap = {}
var LiteCompiler = require(47).LiteCompiler;

var templateCompiler= new LiteCompiler(root);
templateCompiler.waitPromise = true
if(configurator){

try{
if('string' == typeof configurator ){
var args = configurators.split('#');
var path = args[0];
var name = args[1];
var configurator = require(path)[name];
configurator(templateCompiler)
}else if(configurator instanceof Function){
configurator(templateCompiler)
}
}catch(e){
console.error('filter init error:'+e);
}
}
function addTemplateWatch(path,resources){
var template = templateMap[path]={};
for(var i = 0;i<resources.length;i++){
var res = resources[i];
template[res]=true;
var resource= resourceMap[res];
if(resource == null){

resource = resourceMap[res] = {};
addResourceWatch(res);
}
resource[path] = true;
}
}
function addResourceWatch(resourcePath){
fs.watch(require(44).join(root,resourcePath), function (event, filename) {

for(var tplPath in resourceMap[resourcePath]){
var tpl = templateMap[tplPath];
if(tpl && tpl[resourcePath]){
delete templateMap[tplPath];

callback({path:tplPath,action:'remove'})

}
}
});
}

return (function(path){
try{
if(fs.existsSync(root+path)){
var result = templateCompiler.compile(path);
}else{
result = {resources:['./'],
litecode:[],
jscode:'function(c,out){out.push("File Not Found:'+path+'");return out.join()}',
config:{}
};
}

var res = result.resources;

addTemplateWatch(path,res);
callback({path:path,action:'add',code:result.jscode,config:result.config})

}catch(e){

throw e;
callback({path:path,action:'error',
code:"function(){return '<pre>'+"+JSON.stringify(require(5).inspect(e,true)+
'\n\n'+(e.message +e.stack))+"}",
config:{contentType:'text/html',encoding:'utf-8',error:e}
})
}
});
}
exports.setupCompiler = setupCompiler;
}
,
function(exports,require){var ParseConfig = require(15).ParseConfig;
var ParseContext = require(0).ParseContext;
var JSTranslator = require(1).JSTranslator;
var loadLiteXML = require(8).loadLiteXML;
var buildURIMatcher = require(7).buildURIMatcher
var getTemplateId = require(43).getTemplateId
exports.LiteCompiler = LiteCompiler;
exports.execute = function(args){
var options = {};
var key = '';
for(var i=2;i<args.length;i++){
var arg = args[i];
if(arg.charAt() == '-'){
key = arg.substr(1)
options[key] = [];
}else{
options[key].push(arg)
}
}

var root = options.root && options.root[0];
var output = options.output && options.output[0];
compile(root,output,options.translator,
options.includes,options.excludes)
}
function LiteCompiler(root,options){
options = options || {};
var path = require(44);
var root =String(path.resolve(root || './')).replace(/\\/g,'/');
var compileDir = options.compileDir;
var configPath = options.configPath || path.resolve(root,'lite.xml');
if(require(4).existsSync(configPath)){
var dom = loadLiteXML(configPath);

this.config = new ParseConfig(root,dom);
}else if(!options.configPath){
configPath = path.resolve(root,'WEB-INF/lite.xml');
if(require(4).existsSync(configPath)){
var dom = loadLiteXML(configPath);

this.config = new ParseConfig(root,dom);
}
}
this.config = this.config || new ParseConfig(root,null);
this.translator = new JSTranslator({

waitPromise:true
});
console.info("LiteCompiler root:",root);
}
LiteCompiler.prototype.createParseContext = function(path){
return new ParseContext(this.config,path);
}
LiteCompiler.prototype.compile=function(path){
var root = this.config.root;
var context = this.createParseContext(path);
var uri = context.createURI(path);
context.parse(uri);


var litecode = context.toList();
if(litecode.length){

var functionName = getTemplateId(path);
var jscode = this.translator.translate(litecode,{name:functionName});
}else{
var jscode = "function(){}";
}
var res = context.getResources();
var config = context.getConfigMap();
var i = res.length;
while(i--){
res[i] = res[i].path
}
return {resources:res,litecode:litecode,jscode:jscode,config:config};
}

function compile(root,output,translator,includes,excludes){
var fs = require(4)
var path = require(44)
root = fs.realpathSync(root || './');
output = output || path.join(root,'.litecode');
if(!fs.existsSync(output))fs.mkdirSync(output);

var compiler = new LiteCompiler(root);
includes = includes && includes.length && new RegExp(includes.map(buildURIMatcher).join('|'))
excludes = excludes && excludes.length && new RegExp(excludes.map(buildURIMatcher).join('|'))
function loadFile(dir){
fs.readdir(dir,function(err,files){
for(var i=0;i<files.length;i++){
var n = files[i];
var file = dir+'/'+n;

var stat = fs.statSync(file);
if(stat.isFile()){
var p = path.relative(root,file).replace(/^[\/\\]?|\\/g,'/');
if(excludes && excludes.test(p)){
continue;
}
if(includes ? includes.test(p):/\.xhtml$/.test(p)){
console.log('compile:',path.join(output,p))
var result = compiler.compile(p);
var source = ['exports.template=',result.jscode,';\nexports.config = ',JSON.stringify(result.config)].join('')
var id = getTemplateId(p);
fs.writeFile(path.join(output,id)+'.js',source,function(err,path){

})

}

}else if(n.charAt() != '.' &&stat.isDirectory() ){
loadFile(file)
}
}
});
}
loadFile(root);
}
},[])



var editorMap = editorMap || {};
var ParseContext = require(0).ParseContext;
var JSTranslator = require(1).JSTranslator;
var PHPTranslator = require(3).PHPTranslator;
var wrapResponse = require(2).wrapResponse
var resultEditor = CodeMirror(placeMirror, {
value: '',
readOnly:true,
lineNumbers: true,
mode: {name:"javascript"}
});

function buildContext(){
var context = new ParseContext();
var cached = {};
for(var path in editorMap){
cached[path] = editorMap[path].getValue();
}
cached["/source.xhtml"] = templateEditor.getValue();
var baseXMLLoader = context.loadXML;
context.loadXML = function(uri){
if(uri.path){
if(uri.path in cached){
uri = cached[uri.path];
}else{
console.warn("未知文件路径",uri.path)
}
}
return baseXMLLoader.call(context,uri);
}
context.parse(context.createURI('/source.xhtml'));
return context;
}
function compileToJS(){
try{
var context = buildContext();
var litecode = context.toList();
var translator = new JSTranslator();
var jscode = translator.translate(litecode);
}finally{
showResult(jscode);
updateResultRunner('JavaScript',litecode,jscode);
}
}
function compileToNodeJS(){
try{
var context = buildContext();
var litecode = context.toList();
var translator = new JSTranslator({waitPromise:true});
var jscode = translator.translate(litecode);
}finally{
var nodecode = jscode;
showResult(nodecode);
updateResultRunner('NodeJS',litecode,nodecode);
}
}
function compileToPHP(){
try{
var context = buildContext();
var litecode = context.toList();
var id = "/test.xhtml".replace(/[\/\-\$\.!%]/g,'_');
var pt = new PHPTranslator({
waitPromise:true
});
var phpcode = pt.translate(litecode,{name:id});
}finally{
showResult(phpcode);
updateResultRunner('PHP',litecode,phpcode);
}
}
function compileToLite(){
try{
var context = buildContext();
var litecode = context.toList();
var litecode = JSON.stringify(litecode);
}finally{
showResult(litecode);
updateResultRunner('Java',litecode,null);
}
}
