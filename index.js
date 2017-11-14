/*
 * GLOBAL CONFIG
 */
var yourLinkedinAccountName = null; //93341xxxxxxx - email address
var yourLinkedinPassword = null; //testxxxxxxx - pwd
var crawlerTimeGap = 500; // in case it is blocked by Linkedin server due to frequent access.
var schoolNameListFile = 'schoolNameList.json';
var snapShotFolder = 'snapForDebug/';
var fs = require('fs');

/*
 * Initialize Casper
 */
var casper = require('casper').create({
  // Prints debug information to console
  verbose: true,
  // Only debug level messages are printed
  //logLevel: "debug",  //can output info or debug msg to console
    pageSettings: {
        loadImages: true, //The script is much faster when this field is set to false
        loadPlugins: true
        //,userAgent: 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.157 Safari/537.36'
    }
});
var mouse = require("mouse").create(casper); //mimic mouse action

// Evaluating Command Line Arguments
if(casper.cli.has(0) && casper.cli.has(1)) {
  yourLinkedinAccountName = casper.cli.get(0);
  yourLinkedinPassword= casper.cli.get(1);
  casper.echo('Login Email = ' + yourLinkedinAccountName,'GREEN_BAR');
  casper.echo('Login password = protected', 'GREEN_BAR');
}

/*
 * Exception Handling
 * 4 errors: resource.error, page.error, remote.message and casper.page.onResourceTimeout
 */
// http://docs.casperjs.org/en/latest/events-filters.html#page-error
casper.on("page.error", function(msg, trace) {
  this.echo("Error: " + msg);
    // maybe make it a little fancier with the code from the PhantomJS equivalent
  });

// http://docs.casperjs.org/en/latest/events-filters.html#page-initialized
casper.on("page.initialized", function(page) {
    // CasperJS doesn't provide `onResourceTimeout`, so it must be set through 
    // the PhantomJS means. This is only possible when the page is initialized
    page.onResourceTimeout = function(request) {
      console.log('Response Timeout (#' + request.id + '): ' + JSON.stringify(request));
    };
  });


/*
 * Crawler App Starts here
 */
//first to load all university names
var schoolNameListJson = require(schoolNameListFile);
console.log('\033[33m###School Name List: \033[39m');
require('utils').dump(schoolNameListJson);

var schoolNameLinks = [];
var nameCount = -1;
for(var i = 0; i < schoolNameListJson.schoolName.length; i++){
    var url = "https://www.linkedin.com/ta/federator?orig=GLHD&verticalSelector=edu&query=" + schoolNameListJson.schoolName[i];
    schoolNameLinks.push(url);
}
//call Linkedin link to get ids for all universities, no need to login
casper.start();
var schoolIds = [];
casper.then(function(){

    console.log('\033[33m###Retrieving School Id: \033[39m');
    this.each(schoolNameLinks, function(){
        nameCount++;
        this.thenOpen(schoolNameLinks[nameCount],function(){
            var obj = JSON.parse(this.getPageContent());
            var schoolId = null;
            for(var i = 0; i < obj.resultList.length; i++){
                if(obj.resultList[i].sourceID === 'school'){
                    schoolId = obj.resultList[i].id;
                    break;
                }           
            }
            schoolIds.push(schoolId);
            console.log('   ### Received Id: ' + schoolId);
        });
    });
});

casper.thenOpen("https://www.linkedin.com/uas/login", function() {
    console.log('\033[33m### Trying to open Linkedin Login Page \033[39m');
});
casper.waitUntilVisible('#session_key-login', function() {
    console.log('\033[33m### Linkedin Login Page Opened!!! \033[39m');
});


// casper.then(function() {
//     console.log('\033[33m### Trying to login with provided account \033[39m');
//     this.evaluate(function() {  //used to do dom operation
//         document.getElementById("session_key-login").value = yourLinkedinAccountName; 
//         document.getElementById("session_password-login").value = yourLinkedinPassword;
//         document.getElementById("btn-primary").click();
//     });
// });

// casper.waitForSelector('form[method="post"]', function() {
//       this.fillSelectors('form[method="post"]', {
//         'input[id="session_key-login"]': yourLinkedinAccountName,
//         'input[id="session_password-login"]': yourLinkedinPassword
//       });
//       this.click("#btn-primary");
// });

casper.then(function(){
    // this.page.sendEvent('keypress', this.page.event.key.M, null, null, 0x02000000); //type M letter
    // this.capture('p1.1.png'); // capture a snapshot.
    this.mouse.click('form#login input#session_key-login');
    this.wait(500);
    this.sendKeys('form#login input#session_key-login', yourLinkedinAccountName, {keepFocus: true});
    this.mouse.click('form#login input#session_password-login');
    this.wait(500);
    this.sendKeys('form#login input#session_password-login', yourLinkedinPassword, {keepFocus: true});
    //this.click('form#login input#btn-primary');
    this.capture(snapShotFolder + 'beforeSubmit.png'); // capture a snapshot.
    this.mouse.click('form#login input[type="submit"]');
    //this.sendKeys('form#login input#session_password-login', casper.page.event.key.Enter , {keepFocus: true})
});

casper.waitForSelector('.authentication-outlet', function() {
    console.log('\033[33m### Login Succeeded!!! \033[39m');
});

//Getting alumni data 
// var idCount = -1;
var alumniUrl = "https://www.linkedin.com/edu/alumni?trk=edu-alumni-chg-sch&id=";
var schoolsSetJson = {};
casper.then(function(){
    console.log('\033[33m### Trying to load school data... \033[39m');
    this.each(schoolIds, function(self, id, index){
        //idCount++;
        this.thenOpen(alumniUrl+id,function(){
            console.log('   ### handling school id: ' + id);
        })
        .waitForText('Where they live', function() {
            console.log("      *** alumni page load for id:" + id);
        })
        .then(function(){
            var res = this.evaluate(function(){
                var facetItems = document.getElementsByClassName('facet-wrapper');
                var resObj = {};
                for (var i = 0; i < facetItems.length; i++) {
                    var items = facetItems[i].children;
                    var setTitle = items[0].firstChild.nodeValue; //title
                    resObj[setTitle] = [];
                    //items[2] //value
                    var valueSets = items[2].children;
                    for(var j = 0; j < valueSets.length; j++) {
                        var tmpArr = [];
                        tmpArr.push(valueSets[j].getAttribute('title'));
                        tmpArr.push(valueSets[j].getAttribute('data-count'));
                        resObj[setTitle].push(tmpArr);
                    }
                };
                return resObj;
            });
            //write result to outside file.  
            schoolsSetJson[schoolNameListJson.schoolName[index]] = res;
            console.log('      *** Finished School Info: ' + res);
        });
    });
});

casper.then(function(){
    exportToJson(schoolsSetJson);
});

casper.run();

function exportToJson(jsonValue){
    var filename = 'result/result_' + new Date().toUTCString() + '.json';
    fs.write(filename, JSON.stringify(jsonValue), 'w');
    console.log('\033[33m### result exported to ' + filename + '\033[39m')
}

function exportToCSV(jsonValue){
    //to be done
}