import * as yup from 'yup';

export const editSchema = yup.object().shape({
  transcriptionId: yup.string().required(),
  updatedOptimizations: yup.object().shape({
    twitter: yup.string(),
    linkedin: yup.string(),
    reddit: yup.string()
  }).required(),
  userId: yup.string().required()
})

export const optimizeSchema = yup.object({
  transcriptionId: yup.string().required('Transcription ID is required'),
  platforms: yup.array().of(
    yup.string().oneOf(['linkedin', 'twitter', 'reddit'])
  ).optional()
});

export const audioSchema = yup.object({
  audioData: yup.mixed().required('Audio file is required')
});