const { db } = require('../util/admin');
const { isEmpty } = require('../util/validators');

// Retrieve all posts in the database
exports.getAllPosts = (req, res) => {
	db
		.collection('posts')
		.orderBy('createdAt', 'desc')
		.get()
		.then(data => {
			let posts = [];
			data.forEach(doc => {
				posts.push({
					postId: doc.id,
					...doc.data()
				});
			})
			return res.json(posts)
		})
		.catch(err => console.error(err))
}

// Create a post
exports.createPost = (req, res) => {
	const { body } = req.body;
	const { handle, imgUrl } = req.user;

	if(isEmpty(body)){
		return res.status(400).json({ body: "Must not be empty"});
	}

	const newPost = {
		body,
		userHandle: handle,
		createdAt: new Date().toISOString(),
		userImage: imgUrl,
		likeCount: 0,
		commentCount: 0
	};

	db
		.collection('posts')
		.add(newPost)
		.then((doc) => {
			const resPost = newPost;
			resPost.postId = doc.id;
			res.status(200).json(resPost);
		})
		.catch(err => {
			res.status(500).json({ error: `Ooops! Something wen't wrong in here`});
			console.log(err);
		})
}

// Delete a post
exports.deletePost = (req, res) => {
	const { postId } = req.params;
	const { handle } = req.user;
	const postDocument = db.doc(`/posts/${postId}`);

	postDocument.get()
		.then(doc => {
			if(!doc.exists){
				return res.status(404).json({ error: 'Post not found' });
			}
			if(doc.data().userHandle !== handle){
				return res.status(403).json({ error: 'Unauthorized' });
			} else {
				return postDocument.delete()
			}
		})
		.then(() => {
			res.json({ message: 'Post deleted successfully' })
		})
		.catch(err => {
			console.error(err);
			res.status(500).json({ error: err.code });
		})
}

// Fetch one post and associated comments
exports.getPost = (req, res) => {
	let postData = {};

	db.doc(`/posts/${req.params.postId}`).get()
		.then(doc => {
			if(!doc.exists){
				return res.status(404).json({ error: "post not found"})
			}

			postData = doc.data();
			postData.postId = doc.id;

			return db.collection('comments').orderBy('createdAt', 'desc').where('postId', '==', req.params.postId).get();
		})
		.then(data => {
			postData.comments = [];
			data.forEach(doc =>{
				postData.comments.push(doc.data());	
			})

			return res.json(postData);
		})
		.catch(err => {
			console.error(err);
			res.status(500).json({ error: err.code })
		})
}

// Comment on a post
exports.commentOnPost = (req, res) => {
	const { body } = req.body;
	const { handle, imgUrl } = req.user;
	const { postId } = req.params;

	if(isEmpty(body)){
		return res.status(400).json({ comment: "Must not be empty"})
	}

	const newComment = {
		body,
		createdAt: new Date().toISOString(),
		postId,
		userHandle: handle,
		userImage: imgUrl,
		commentId: ""
	}

	db.doc(`/posts/${postId}`).get()
		.then(doc => {
			if(!doc.exists){
				return res.status(404).json({ error: "Post not found" })
			}

			return doc.ref.update({ commentCount: doc.data().commentCount + 1 })
		})
		.then(() => {
			return db.collection('comments').add(newComment)
		})
		.then((commentRef) => {
			newComment.commentId = commentRef.id;
			return db.doc(`/comments/${commentRef.id}`).update({ commentId: commentRef.id })
		})
		.then(()=>{
			return res.status(200).json(newComment)
		})
		.catch(err => {
			return res.status(500).json({ error: 'Something went wrong' })
		})
}

// Delete a comment
exports.deleteComment = (req, res) => {
	const { commentId } = req.params;
	const { handle } = req.user;
	const commentDocument = db.doc(`/comments/${commentId}`);

	commentDocument.get()
		.then(doc => {
			if(!doc.exists){
				return res.status(404).json({ error: 'Comment not found' });
			}
			if(doc.data().userHandle !== handle){
				return res.status(403).json({ error: 'Unauthorized' });
			} else {
				const postId = doc.data().postId;

				db.doc(`/posts/${postId}`).get()
					.then((postDoc) => {
						postDoc.ref.update({ commentCount: postDoc.data().commentCount - 1 })
					})
					.catch(err => {
						res.status(500).json({ error: err.code });
					})

				return commentDocument.delete()
			}
		})
		.then(() => {
			res.json({ message: 'Comment deleted successfully' })
		})
		.catch(err => {
			console.error(err);
			res.status(500).json({ error: err.code });
		})
}

// Like a post
exports.likePost = (req, res) => {
	const { handle, imgUrl } = req.user;
	const { postId } = req.params;

	// Returns a document for the "like" if the user (userHandle) currently likes the post (postId)
	const likeDocument = db.collection('likes')
						.where('userHandle', '==', handle)
						.where('postId', '==', postId)
						.limit(1);

	// Returns the document for the post with the postId
	const postDocument = db.doc(`/posts/${postId}`);

	let postData;

	postDocument.get()
		.then(doc => {
			// checks if post (still) exists before trying to like it
			if(doc.exists){
				postData = doc.data();
				postData.postId = doc.id;

				return likeDocument.get()
			}else{
				res.status(404).json({ error: 'Post not found'})
			}
		})
		.then(data => {
			// data is empty if the post is not currently liked by the userHandle
			if(data.empty){
				return db.collection('likes').add({
					postId,
					userHandle: handle,
					userImage: imgUrl
				})
				.then(() => {
					postData.likeCount++;
					return postDocument.update({ likeCount: postData.likeCount})
				})
				.then(() => {
					return res.json(postData);
				})
			} else {
				// data is not empty if the post has already been liked (so can't be liked again)
				return res.status(400).json({ error: 'Post already liked'});
			}
		})
		.catch(err => {
			console.error(err);
			res.status(500).json({ error: err.code });
		})
}

// Unlike a post
exports.unlikePost = (req, res) => {
	const { handle } = req.user;
	const { postId } = req.params;

	// Returns a document for the "like" if the user (userHandle) currently likes the post (postId)
	const likeDocument = db.collection('likes')
						.where('userHandle', '==', handle)
						.where('postId', '==', postId)
						.limit(1);

	// Returns the document for the post with the postId
	const postDocument = db.doc(`/posts/${postId}`);

	let postData;

	postDocument.get()
		.then(doc => {
			// checks if post (still) exists before trying to like it
			if(doc.exists){
				postData = doc.data();
				postData.postId = doc.id;

				return likeDocument.get()
			}else{
				res.status(404).json({ error: 'Post not found'})
			}
		})
		.then(data => {
			if(data.empty){
				// data is empty if the post isn't currently liked by the userHandle
				return res.status(400).json({ error: 'Post is already not liked'});
			} else {
				// data is not empty if the post is liked by the userHandle (so it can be unliked)
				return db.doc(`/likes/${data.docs[0].id}`).delete()
					.then(() => {
						postData.likeCount--;
						return postDocument.update({ likeCount: postData.likeCount });
					})
					.then(() => {
						return res.json(postData);
					})
			}
		})
		.catch(err => {
			console.error(err);
			res.status(500).json({ error: err.code });
		})
}