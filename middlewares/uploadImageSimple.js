const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

// Configuración de almacenamiento en memoria
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

// Middleware para procesar y guardar imagen (versión simple sin Sharp)
const processImageSimple = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  try {
    // Crear directorio si no existe
    const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'events');
    await fs.mkdir(uploadDir, { recursive: true });

    // Obtener extensión original
    const originalExt = path.extname(req.file.originalname).toLowerCase();
    
    // Generar nombre único para el archivo
    const filename = `${uuidv4()}${originalExt}`;
    const filepath = path.join(uploadDir, filename);

    // Guardar archivo sin procesamiento
    await fs.writeFile(filepath, req.file.buffer);

    // Agregar información del archivo procesado al request
    req.processedImage = {
      filename: filename,
      url: `/uploads/events/${filename}`,
      originalName: req.file.originalname,
      size: req.file.size
    };

    console.log('[UploadImageSimple] Imagen guardada:', {
      filename,
      originalName: req.file.originalname,
      size: req.file.size
    });

    next();
  } catch (error) {
    console.error('Error guardando imagen:', error);
    next(new Error('Error guardando la imagen'));
  }
};

// Función para eliminar imagen
const deleteImageSimple = async (filename) => {
  if (!filename) return;
  
  try {
    const filepath = path.join(__dirname, '..', 'public', 'uploads', 'events', filename);
    await fs.unlink(filepath);
    console.log('[UploadImageSimple] Imagen eliminada:', filename);
  } catch (error) {
    console.error('Error eliminando imagen:', error);
  }
};

module.exports = {
  upload: upload.single('image'),
  processImage: processImageSimple,
  deleteImage: deleteImageSimple
};
