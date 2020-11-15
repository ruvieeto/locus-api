
// Returns true if string is empty, false if not
const isEmpty = (string) =>{
	return (string.trim() === '')
}

exports.isEmpty = isEmpty;

// Returns true if valid email address, false if not
const isEmail = (email) => {
	const emailRegEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
	return email.match(emailRegEx); // returns true or false if email matches regex 
}

exports.validateSignupData = (data) => {
	let errors = {};

	// Checks if email input is empty and a real email address
	if(isEmpty(data.email)){
		errors.email = "Must not be empty"
	}else if(!isEmail(data.email)){
		errors.email = "Must be a valid email address"
	}

	// Checks if password input is empty and matches confirm password input
	if(isEmpty(data.password)){
		errors.password = "Must not be empty"
	}
	if(data.password !== data.confirmPassword){
		errors.confirmPassword = "Passwords must match";
	}

	// Checks if user handle input is empty
	if(isEmpty(data.handle)){
		errors.handle = "Must not be empty";
	}

	return {
		errors,
		isValid: Object.keys(errors).length === 0 ? true : false
	}
}

exports.validateLoginData = (data) =>{
	let errors = {};

	if(isEmpty(data.email)){
		errors.email = "Must not be empty."
	} else if(!isEmail(data.email)){
		errors.email = "Must be a valid email address."
	}

	if(isEmpty(data.password)){
		errors.password = "Must not be empty."
	}

	return {
		errors,
		isValid: Object.keys(errors).length === 0? true: false
	}
}

exports.reduceUserDetails = (data) => {
	// data will typically be received from req.body

	let userDetails = {};

	if(!isEmpty(data.bio)) userDetails.bio = data.bio

	if(!isEmpty(data.location)) userDetails.location = data.location;

	if(!isEmpty(data.website)){
		if(data.website.trim().substring(0, 4) !== 'http'){
			userDetails.website = `http://${data.website.trim()}`
		}
		else{
			userDetails.website = data.website;
		}
	}

	if(!isEmpty(data.location)) userDetails.location = data.location;

	return userDetails;
}