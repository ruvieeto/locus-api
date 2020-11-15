const functions = require('firebase-functions');

const express = require('express');
const app = express();

const { db } = require('./util/admin');

const { 
	getAllPosts, 
	createPost, 
	getPost,
	commentOnPost,
	likePost,
	unlikePost,
	deletePost
} = require('./handlers/posts');

const { 
	signup, 
	login, 
	uploadImage, 
	addUserDetails, 
	getAuthenticatedUser,
	getUserDetails,
	markNotificationsRead
} = require('./handlers/users');

// Firebase Authentication Middleware
const FBAuth = require('./util/fbAuth');

// Posts Routes
app.get('/posts', getAllPosts);
app.post('/post', FBAuth, createPost);
app.get('/post/:postId', getPost);
app.post('/post/:postId/comment', FBAuth, commentOnPost);
app.get('/post/:postId/like', FBAuth, likePost);
app.get('/post/:postId/unlike', FBAuth, unlikePost);
app.delete('/post/:postId', FBAuth, deletePost);
// TO DO: Delete comment

// User Routes
app.post('/signup', signup)
app.post('/login', login)
app.post('/user/image', FBAuth, uploadImage);
app.post('/user', FBAuth, addUserDetails);
app.get('/user', FBAuth, getAuthenticatedUser);
app.get('/user/:handle', getUserDetails);
app.post('/notifications', FBAuth, markNotificationsRead);

// mounting the app object on the exported api function
exports.api = functions.https.onRequest(app);



// Notification for like on your post
exports.createNotificationOnLike = functions.firestore.document('likes/{id}')
	.onCreate((snapshot) => {
		return db.doc(`/posts/${snapshot.data().postId}`)
			.get()
			.then(doc => {
				if(doc.exists && doc.data().userHandle !== snapshot.data().userHandle){
					db.doc(`/notifications/${snapshot.id}`).set({
						createdAt: new Date().toISOString(),
						recipient: doc.data().userHandle,
						sender: snapshot.data().userHandle,
						type: 'like',
						read: false,
						postId: doc.id
					})
				}
			})
			.catch(err => {
				console.error(err);
			})
	})

// Remove notification for unliked post
exports.deleteNotificationOnUnlike = functions.firestore.document('likes/{id}')
	.onDelete((snapshot) => {
		return db.doc(`/notifications/${snapshot.id}`).delete()
			.catch(err => {
				console.error(err);
			})
	})

// Notification for comment on your post
exports.createNotificationOnComment = functions.firestore.document('comments/{id}')
	.onCreate((snapshot) => {
		db.doc(`/posts/${snapshot.data().postId}`).get()
			.then(doc => {
				if(doc.exists && doc.data().userHandle !== snapshot.data().userHandle){
					return db.doc(`/notifications/${snapshot.id}`).set({
						createdAt: new Date().toISOString(),
						recipient: doc.data().userHandle,
						sender: snapshot.data().userHandle,
						type: 'comment',
						read: false,
						postId: doc.id
					})
				}
			})
			.catch(err => {
				console.error(err);
			})
	})

// Remove notification for deleted comment
exports.deleteNotificationOnCommentDeletion = functions.firestore.document('comments/{id}')
	.onDelete((snapshot) => {
		return db.doc(`/notifications/${snapshot.id}`).delete()
			.catch(err => {
				console.error(err)
			})
	})

// Update user profile picture in all posts
exports.onUserImageChange = functions.firestore.document('users/{userId}')
	.onUpdate((change) => {
		if(change.before.data().imgUrl !== change.after.data().imgUrl){
			console.log('image has changed');
			const batch = db.batch();

			return db.collection('posts')
				.where('userHandle', '==', change.before.data().handle)
				.get()
				.then(data => {
					data.forEach(post => {
						const postRef = db.doc(`/posts/${post.id}`)
						batch.update(postRef, { userImage: change.after.data().imgUrl})
					})

					return batch.commit();
				})
		} else {
			return true;
		}
	})

// Delete all associated comments, likes, notifications when a post is deleted
exports.onPostDelete = functions.firestore.document('posts/{postId}')
	.onDelete((snapshot, context) => {
		const postId = context.params.postId;
		const batch = db.batch();

		return db.collection('comments').where('postId', '==', postId).get()
			.then(data => {
				data.forEach(comment => {
					const commentRef = db.doc(`/comments/${comment.id}`);
					batch.delete(commentRef);
				})

				return db.collection('likes').where('postId', '==', postId).get()
			})
			.then(data => {
				data.forEach(like => {
					const likeRef = db.doc(`/likes/${like.id}`);
					batch.delete(likeRef);
				})

				return db.collection('notifications').where('postId', '==', postId).get()
			})
			.then(data => {
				data.forEach(notification => {
					const notificationRef = db.doc(`/notifications/${notification.id}`);
					batch.delete(notificationRef);
				})

				return batch.commit();
			})
			.catch(err => {
				console.error(err);
			})
	})