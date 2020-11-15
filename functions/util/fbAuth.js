const { admin, db } = require('./admin');

// Verifying token
module.exports = (req, res, next) => {
	let idToken;
	if(req.headers.authorization && req.headers.authorization.startsWith('Bearer ')){
		idToken = req.headers.authorization.split('Bearer ')[1]; // extracting the actual token
	} else{
		return res.status(403).json({error: "Unauthorized"})
	}

	admin.auth().verifyIdToken(idToken)
		.then(decodedToken => {
			// The decoded token is object with properties like user id, email address, expiry date etc. for the token provided 
			req.user = decodedToken; 

			// Getting the user with the user ID (associated to the token)
			return db.collection('users')
				.where('userId', '==', req.user.uid)
				.limit(1)
				.get()
		})
		.then(data => {
			// Passing the handle for that user from the database as part of request.user
			req.user.handle = data.docs[0].data().handle;
			req.user.imgUrl = data.docs[0].data().imgUrl;
			
			// Proceed to route handler if OK	
			return next();
		})
		.catch(err => {
			console.error('Error while verifying token', err);
			return res.status(403).json(err);
		})
}