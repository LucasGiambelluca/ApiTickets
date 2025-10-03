const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

// Configuración de almacenamiento
const storage = multer.memoryStorage();

// Filtro para validar tipos de archivo
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos de imagen (jpeg, jpg, png, gif, webp)'));
  }
};

// Configuración de multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB máximo
  },
  fileFilter: fileFilter
});

// Middleware para procesar y guardar imagen
const processImage = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  try {
    // Crear directorio si no existe
    const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'events');
    await fs.mkdir(uploadDir, { recursive: true });

    // Generar nombre único para el archivo
    const filename = `${uuidv4()}.webp`;
    const filepath = path.join(uploadDir, filename);

    // Procesar imagen con sharp (redimensionar y optimizar)
    await sharp(req.file.buffer)
      .resize(800, 600, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .webp({ quality: 85 })
      .toFile(filepath);

    // Agregar información del archivo procesado al request
    req.processedImage = {
      filename: filename,
      url: `/uploads/events/${filename}`,
      originalName: req.file.originalname,
      size: req.file.size
    };

    next();
  } catch (error) {
    console.error('Error procesando imagen:', error);
    next(new Error('Error procesando la imagen'));
  }
};

// Función para eliminar imagen
const deleteImage = async (filename) => {
  if (!filename) return;
  
  try {
    const filepath = path.join(__dirname, '..', 'public', 'uploads', 'events', filename);
    await fs.unlink(filepath);
  } catch (error) {
    console.error('Error eliminando imagen:', error);
  }
};

module.exports = {
  upload: upload.single('image'),
  processImage,
  deleteImage
};
