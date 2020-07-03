import app from '../app';
import http from 'http';
import config from '../config/index'
/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val:any) {
    var port = parseInt(val, 10);
  
    if (isNaN(port)) {
      // named pipe
      return val;
    }
  
    if (port >= 0) {
      // port number
      return port;
    }
  
    return false;
  }
  
// Get port from environment and store in Express.
const port = normalizePort(config.port || '3000');
app.set('port', port);

app.listen(port, () => {
  console.log('Server is up on port ' + port)
})