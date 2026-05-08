import bcrypt from "bcryptjs";

export const hashPassword = async (plainPassword) => {
	return bcrypt.hash(plainPassword, 10);
};

export const comparePassword = async (plainPassword, hashedPassword) => {
	return bcrypt.compare(plainPassword, hashedPassword);
};
