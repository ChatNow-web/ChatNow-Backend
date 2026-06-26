const Joi = require('joi');

const validateInput = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        errors: error.details.map(e => e.message)
      });
    }
    req.validated = value;
    next();
  };
};

const schemas = {
  signup: Joi.object({
    username: Joi.string().alphanum().min(3).max(20).required(),
    password: Joi.string().min(8)
      .pattern(/[A-Z]/).pattern(/[a-z]/).pattern(/[0-9]/)
      .required(),
    email: Joi.string().email().optional(),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required()
  }),

  login: Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required()
  }),

  googleAuth: Joi.object({
    googleToken: Joi.string().required()
  }),

  createRoom: Joi.object({
    name: Joi.string().min(1).max(50).required(),
    password: Joi.string().min(4).max(50).optional(),
    maxMembers: Joi.number().min(2).max(1000).optional()
  }),

  joinRoom: Joi.object({
    roomCode: Joi.string().required(),
    password: Joi.string().allow('').optional()
  }),

  sendMessage: Joi.object({
    content: Joi.string().max(5000).required(),
    contentType: Joi.string().valid('text', 'image', 'file').default('text'),
    attachmentURL: Joi.string().uri().optional()
  }),

  reactToMessage: Joi.object({
    emoji: Joi.string().valid('👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉', '💯', '⭐').required(),
    action: Joi.string().valid('add', 'remove').required()
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8)
      .pattern(/[A-Z]/).pattern(/[a-z]/).pattern(/[0-9]/)
      .required(),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
  }),

  adminLogin: Joi.object({
    adminCode: Joi.string().required(),
    adminPassword: Joi.string().required()
  }),

  banUser: Joi.object({
    userId: Joi.string().required(),
    reason: Joi.string().max(200).required()
  }),

  createAdmin: Joi.object({
    adminCode: Joi.string().min(3).max(20).required(),
    adminPassword: Joi.string().min(8).required()
  }),

  deleteMessage: Joi.object({
    reason: Joi.string().max(200).optional()
  })
};

module.exports = { validateInput, schemas };
