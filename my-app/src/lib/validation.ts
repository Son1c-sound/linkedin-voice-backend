import * as yup from 'yup';

export const editSchema = yup.object({
  transcriptionId: yup.string()
    .required('Transcription ID is required'),
  updatedText: yup.string()
    .required('Updated text is required')
    .min(10, 'Text must be at least 10 characters long')
    .max(3000, 'Text must not exceed 3000 characters'),
  userId: yup.string().required('User ID is required')
});

export const optimizeSchema = yup.object({
  transcriptionId: yup.string()
    .required('Transcription ID is required'),
  optimizedContent: yup.string().nullable(),
  hashtags: yup.array().of(yup.string()).nullable(),
  tone: yup.string().nullable(),
  targetAudience: yup.string().nullable(),
  status: yup.string().oneOf(['pending', 'optimized', 'failed']).default('pending'),
  updatedAt: yup.date().default(() => new Date())
});

export const audioSchema = yup.object({
  audioData: yup.mixed().required('Audio file is required')
});