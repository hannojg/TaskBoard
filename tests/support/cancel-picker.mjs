import childProcess from 'node:child_process';

childProcess.execFile = (command,args,options,callback) => {
 if (command !== '/usr/bin/osascript') throw new Error('Expected the native macOS picker.');
 callback(null,'\n','');
};
