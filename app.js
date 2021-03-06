/*
Author:
Vivekkumar Chaudhari (vcha0018@student.monash.edu) 
    Student - Master of Information Technology
    Monash University, Clayton, Australia

Purpose:
Developed under Summer Project 'AR Hand Gesture Capture and Analysis'

Supervisors: 
Barrett Ens (barrett.ens@monash.edu)
    Monash University, Clayton, Australia
 Max Cordeil (max.cordeil@monash.edu)
    Monash University, Clayton, Australia

About File:
Entry point of the application.
It server client requestes and catch responses from clients using post methods.
Also, parse the response json and save cordinate data to csv files.
*/

// Add required libraries
const bodyParser = require('body-parser');
const fs = require('fs');
const https = require('https');
const express = require('express');
const app = express();
// Default Port configuration
const PORT = process.env.PORT || 8000;
// DropBox Token Id
const DB_TKN = 'NCkvNvPoTDoAAAAAAAAAAcOy_lNN3xraUL1krzJn6werjpsap8GpKkPc6o_VQbti';

//site variables
const appInfo = {
    title: '3D Hand Gestures Analysis', 
    description:'WEB API for detecting hand gestures',
};

// All Page basic informations
// Note: Do not chnage this unless you know what you are doing, this is depended to many things. app might crash if you modify this!
const pageInfo = [
    {key: 'index', value: ''},
    {key: 'handpose', value: 'HandPose'},
    {key: 'mediapipe', value: 'MediaPipe'},
    {key: 'contact', value: 'Contact Us'},
];

// Available Gesture types(actions).
const positionList = [
    "Select Range",
    "Select Lasso", 
    "Select Cluster", 
    "Select Single Point", 
    "Select Axis", 
    "Multi-Select", 
    "Zoom", 
    "Pan", 
    "Rotate", 
    "Filter", 
    "Highlight", 
    "Save View", 
    "Export Data"
];

// Build dynamic navigation menu script
function GetNavMenu(){
    menu = [];
    pageInfo.forEach(function(item){
        menu.push({
            href: '/' + item.key,
            text: item.value
        });
    });
    return menu;
};

//Path info (set)
app.use(express.static('public')); // static directory access to "public" directory (css, js, etc.).
app.set('views', './src/views/pages');
app.set('view engine', 'ejs');

app.use(bodyParser.text());
app.use(bodyParser.urlencoded({
  parameterLimit: 100000,
  limit: '50mb',
  extended: true
}));

// Start the server
app.listen(PORT, (err) => {
    console.log(`Web app running at http://localhost:${PORT}`)
    console.log(`App listening on port ${PORT}`);
    console.log('Press Ctrl+C to quit.');
});

//Routing using Express Router 
var handposeRouter = require('./src/routes/handposeRoute')(appInfo, pageInfo[1], GetNavMenu(), positionList);
var mediapipeRouter = require('./src/routes/mediapipeRoute')(appInfo, pageInfo[2], GetNavMenu(), positionList);
var contactRouter = require('./src/routes/contactRoute')(appInfo, pageInfo[3], GetNavMenu());

// Navigation to routes
app.use('/' + pageInfo[1].key, handposeRouter);
app.use('/' + pageInfo[2].key, mediapipeRouter);
app.use('/' + pageInfo[3].key, contactRouter);

// Home page request/response
app.get('/', (req, res) => {
    res
    .status(200)
    .render(pageInfo[0].key, {
        info: appInfo,
        title: appInfo.title,
        description: appInfo.description,
        menu: GetNavMenu(),
        pHeader: "Hand gesture Projects",
        pDescription: ""
    });
});

app.post('/', (req, res) => {
    // nothig yet
});

// MediaPipe page request/response
app.post('/mediapipe', function(req, res) {
    try {
        saveFileLocally(
            buildFilesData(
                `results/mediapipe/${req.body.dirName.toString().trim()}`, 
                req.body.data, 
                "mediapipe")
        );
        res.status(200);
    } catch (error) {
        console.log(error);
    }
    res.end(); // end the response
});

// HandPose page request/response
app.post('/handpose', (req, res) => {
    try {
        uploadFilesToDropBox(
            buildFilesData(
                `results/handpose/${req.body.dirName.toString().trim()}`, 
                req.body.data, 
                "handpose")
        );
        res.status(200);
    } catch (error) {
        console.log(error);
    }
    res.end(); // end the response
});

// To convert json string to csv string.
function JSONToCSVString(jsonData, isMediaPipeData) {
    sampleData = "";
    sampleData += "TIME";
    for (let i = 0; i < 21; i ++) {
        sampleData += `,JOINT_${i}_X, JOINT_${i}_Y, JOINT_${i}_Z`;
    }
    sampleData += "\n";
    for (let i = 0; i < jsonData.length; i++) {
        sampleData += `${jsonData[i].time}`;
        // console.log(`i: ${i}`);
        for (let j = 0; j < jsonData[i].keypoints.length; j++) {
            if (jsonData[i].keypoints.length == 21)
                if (isMediaPipeData)
                    sampleData += `,${jsonData[i].keypoints[j].x}, ${jsonData[i].keypoints[j].y}, ${'z' in jsonData[i].keypoints[j] ? jsonData[i].keypoints[j].z : '0'}`;
                else if (jsonData[i].keypoints[j].length == 3)
                    sampleData += `,${jsonData[i].keypoints[j][0]}, ${jsonData[i].keypoints[j][1]}, ${jsonData[i].keypoints[j][2]}`;
        }
        sampleData += "\n";
    }
    return sampleData;
}

// build csv file data directory with given string as its content.
function buildFilesData(dirPath, responseData, apiName) {
    const operation = responseData.opIndex.toString().trim() + "_" + responseData.operation.toString().trim();
    const datetime = responseData.datetime.toString().trim();
    let fileData = []
    for (const [key, value] of Object.entries(responseData.handdata)) {
        const fileName = `${operation}#${key}#${datetime}.csv`;
        const filePath = `${dirPath}/${fileName}`;
        const csvData = JSONToCSVString(value, apiName.toLowerCase().includes("mediapipe"));
        fileData.push({path: filePath, api: apiName, data: csvData});
    }
    return fileData;
}

// create csv files locally with given csv data directories.
function saveFileLocally(fileData) {
    const dirPath = fileData[0].path.substring(0, fileData[0].path.lastIndexOf('/'));
    if(!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath);
    }
    fileData.forEach(fileInfo => {
        fs.writeFile(fileInfo.path, fileInfo.data, {
            flag: "w"
            }, function(err) {
            if (err) {
                return console.log(err);
            }
            console.log("The new file was created on server pc: " + fileInfo.path);
            console.log(`Create#${fileInfo.path.substring(fileInfo.path.indexOf(fileInfo.api) + fileInfo.api.length)}`);
        });
    });
}

// create csv files on dropbox with given csv data directories.
function uploadFilesToDropBox(filesData) {
    filesData.forEach(fileInfo => {
        const req = https.request('https://content.dropboxapi.com/2/files/upload', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${DB_TKN}`,
            'Dropbox-API-Arg': JSON.stringify({
                'path': `/${fileInfo.path}`,
                'mode': 'overwrite',
                'autorename': true, 
                'mute': false,
                'strict_conflict': false
            }),
            'Content-Type': 'application/octet-stream',
        }
        }, (res) => {
            console.log("statusCode: ", res.statusCode);
            if (res.statusCode == 200) {
                console.log('File Uploaded Successfully!');
                console.log(`Upload#${fileInfo.path.substring(fileInfo.path.indexOf(fileInfo.api) + fileInfo.api.length)}`);
            }
            // console.log("headers: ", res.headers);
            res.on('data', function(d) {
                // process.stdout.write(d);
            });
        });

        req.write(fileInfo.data);
        req.end();
    });
}