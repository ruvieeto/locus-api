const { admin, db } = require('../util/admin');

const firebase = require('firebase');
const firebaseConfig = require('../util/firebaseConfig')
firebase.initializeApp(firebaseConfig);

const { validateSignupData, validateLoginData, reduceUserDetails } = require('../util/validators');

// Sign up new user
exports.signup = (req, res) => {
	const { email, password, confirmPassword, handle } = req.body;
	const newUser = {
		email,
		password,
		confirmPassword,
		handle
	}

	// Validating user data inputs
	const { errors, isValid } = validateSignupData(newUser);

	if(!isValid){
		return res.status(400).json(errors);
	}

	const defaultProfilePhoto = 'no-img.png';

	// Creating new user
	let token;
	let userId;

	db.doc(`/users/${newUser.handle}`).get()
		.then(doc => {
			if(doc.exists){
				// Checks if handle already exists
				return res.status(400).json({ handle: 'This handle is already taken.' })
			} else {
				return firebase.auth().createUserWithEmailAndPassword(newUser.email, newUser.password)
						.then(data =>{
							userId = data.user.uid;
							return data.user.getIdToken();
						})
						.then(idToken => {
							token = idToken;
							const userCredentials = {
								handle: newUser.handle,
								email: newUser.email,
								createdAt: new Date().toISOString(),
								imgUrl: `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${defaultProfilePhoto}?alt=media`,
								userId
							};

							return db.doc(`/users/${newUser.handle}`).set(userCredentials);
						})
						.then(()=>{
							return res.status(201).json({ token });
						})
						.catch(err => {
							console.error(err);
							if(err.code === "auth/email-already-in-use"){
								return res.status(400).json({ email: "Email is already in use."})
								// Maybe add error code for password length/strength
							}else{
								return res.status(500).json({ general: 'Something went wrong, please try again', error: err.code })
							}
						})
			}
		})
}

// Login existing user
exports.login = (req, res) =>{
	const { email, password } = req.body;
	const user = {
		email,
		password
	}

	// Login form data validation
	const { errors, isValid } = validateLoginData(user);
	
	if(!isValid){
		return res.status(400).json(errors);
	}

	// Logging in the user
	return firebase.auth().signInWithEmailAndPassword(user.email, user.password)
			.then(data => {
				return data.user.getIdToken();
			})
			.then(token =>{
				return res.json({token})
			})
			.catch((err)=>{
				console.error(err);
				if(err.code === "auth/wrong-password"){
					return res.status(403).json({ general: "Wrong credentials, please try again." });
				} else if(err.code === "auth/user-not-found"){
					return res.status(403).json({ general: "Wrong credentials, please try again." });
				} else{
					return res.status(500).json({ error: err.code });
				}
			})
}

//Add User Details e.g. Bio, Location, Website etc.
exports.addUserDetails = (req, res) => {
	let userDetails = reduceUserDetails(req.body);

	db.doc(`/users/${req.user.handle}`).update(userDetails)
		.then(()=>{
			return res.json({ message: "Details updated successfully"})
		})
		.catch(err =>{
			return res.status(500).json({ error: err.code});
		})
}

// Get own user details 
exports.getAuthenticatedUser = (req, res) => {
	const { handle } = req.user;
	let userData = {};

	db.doc(`/users/${handle}`).get()
		.then(doc =>{
			if(doc.exists){
				userData.credentials = doc.data();
				return db.collection('likes').where('userHandle', '==', handle).get();
			}
		})
		.then(likesData => {
			userData.likes = [];
			likesData.forEach(doc =>{
				userData.likes.push(doc.data());
			})

			return db
					.collection('notifications')
					.where('recipient', '==', handle)
					.orderBy('createdAt', 'desc')
					.limit(10)
					.get()
		})
		.then(data => {
			userData.notifications = [];
			data.forEach(doc => {
				userData.notifications.push({
					...doc.data(),
					notificationId: doc.id
				})
			})

			return res.json(userData)
		})
		.catch(err => {
			console.error(err);
			return res.status(500).json({ error: err.code })
		})
}

// Get any user's details
exports.getUserDetails = (req, res) => {
	const { handle } = req.params;
	let userData = {};

	db.doc(`/users/${handle}`).get()
		.then(doc => {
			if(doc.exists){
				userData.user = doc.data();
				return db.collection('posts').where('userHandle', '==', handle)
						.orderBy('createdAt', 'desc')
						.get()
			}
			else{
				return res.status(404).json({ error: "User not found" })
			}
		})
		.then(data => {
			userData.posts = [];
			data.forEach(doc => {
				userData.posts.push({
					...doc.data(),
					postId: doc.id
				})
			})

			return res.json(userData);
		})
		.catch(err => {
			console.error(err);
			res.status(500).json({ err: err.code });
		})
}

// Upload a profile image from user
exports.uploadImage = (req, res) =>{
	const BusBoy = require('busboy');
	const path = require('path');
	const os = require('os');
	const fs = require('fs');

	const busboy = new BusBoy({ headers: req.headers });

	let imageFileName;
	let imageToBeUploaded = {};

	busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
		// Validates that file is an image
		if(mimetype !== 'image/jpeg' && mimetype !== 'image/png'){
			return res.status(400).json({ error: "wrong file type submitted" })
		}

		const imageExtension = filename.split('.')[filename.split('.').length - 1]; // works for names like "my.super.cool.img.png"
		imageFileName = `${Math.round(Math.random()*100000000000)}.${imageExtension}`; // e.g. 293873882773873.png
		const filepath = path.join(os.tmpdir(), imageFileName);
		imageToBeUploaded = { filepath, mimetype }

		file.pipe(fs.createWriteStream(filepath)); // writes file from busboy to created stream at the filepath 
	})

	busboy.on('finish', ()=>{
		admin.storage().bucket(firebaseConfig.storageBucket).upload(imageToBeUploaded.filepath, {
			resumable: false,
			metadata: {
				metadata: {
					contentType: imageToBeUploaded.mimetype
				}
			}
		})
		.then(()=>{
			const imgUrl = `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${imageFileName}?alt=media`;
			return db.doc(`/users/${req.user.handle}`).update({ imgUrl });
		})
		.then(()=>{
			return res.status(200).json({ message: "Image uploaded successfully"})
		})
		.catch(err=>{
			console.error(err);
			return res.status(500).json({ error: error.code })
		})
	})

	busboy.end(req.rawBody);
}

// Mark a notification as read
exports.markNotificationsRead = (req, res) => {
	let batch = db.batch();

	req.body.forEach(notificationId => {
		const notificationRef = db.doc(`/notifications/${notificationId}`);
		batch.update(notificationRef, { read: true })
	});

	batch.commit()
		.then(() => {
			res.json({ message: "Notifications marked as read" })
		})
		.catch(err => {
			console.error(err);
			return res.status(500).json({ error: err.code });
		})
}