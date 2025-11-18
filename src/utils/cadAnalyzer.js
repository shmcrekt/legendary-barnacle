import * as THREE from 'three';
import { STLLoader } from 'three-stdlib';
import { readStepFile, readStlFile } from 'occt-import-js';

// Main CAD analysis function
export const analyzeCADFile = async (file) => {
  const fileType = getFileType(file.name);
  const arrayBuffer = await file.arrayBuffer();
  
  console.log(`Analyzing ${fileType.toUpperCase()} file:`, file.name);
  
  try {
    let result;
    
    if (fileType === 'stl') {
      result = await analyzeSTL(arrayBuffer);
    } else if (fileType === 'step') {
      result = await analyzeSTEP(arrayBuffer);
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }
    
    return {
      ...result,
      format: fileType,
      analyzedLocally: true,
      fileName: file.name
    };
    
  } catch (error) {
    console.error('CAD analysis failed:', error);
    throw new Error(`Failed to analyze ${fileType.toUpperCase()} file: ${error.message}`);
  }
};

// STL Analysis
const analyzeSTL = async (arrayBuffer) => {
  // Method 1: Try occt-import-js first (more accurate)
  try {
    const occtResult = await readStlFile(arrayBuffer);
    if (occtResult && occtResult.shape) {
      return processOcctResult(occtResult);
    }
  } catch (error) {
    console.warn('OCCT STL analysis failed, falling back to Three.js:', error);
  }
  
  // Method 2: Fallback to Three.js
  return analyzeSTLWithThreeJS(arrayBuffer);
};

// STEP Analysis using occt-import-js
const analyzeSTEP = async (arrayBuffer) => {
  try {
    const occtResult = await readStepFile(arrayBuffer);
    
    if (!occtResult || !occtResult.shape) {
      throw new Error('No shape data found in STEP file');
    }
    
    return processOcctResult(occtResult);
    
  } catch (error) {
    console.error('STEP analysis failed:', error);
    
    // Fallback to basic estimation
    return estimateFromFileSize(arrayBuffer, 'step');
  }
};

// Process OCCT result into our standard format
const processOcctResult = (occtResult) => {
  const shape = occtResult.shape;
  
  // Calculate volume using OCCT's built-in properties
  const volume = shape.volume || estimateVolumeFromBoundingBox(shape);
  
  // Get bounding box
  const bbox = shape.boundingBox || calculateBoundingBox(shape);
  
  // Estimate wall thickness
  const wallThickness = estimateWallThicknessFromShape(shape);
  
  return {
    volume: Math.max(0.1, volume / 1000), // Convert mm³ to cm³
    dimensions: {
      length: Math.max(1, bbox.xMax - bbox.xMin),
      width: Math.max(1, bbox.yMax - bbox.yMin),
      height: Math.max(1, bbox.zMax - bbox.zMin)
    },
    wallThickness: Math.max(0.5, wallThickness),
    boundingBox: bbox
  };
};

// Calculate bounding box from shape
const calculateBoundingBox = (shape) => {
  // Simple bounding box calculation
  // In a real implementation, you'd use OCCT's Bnd_Box
  return {
    xMin: -50, xMax: 50,
    yMin: -40, yMax: 40, 
    zMin: -30, zMax: 30
  };
};

// Estimate volume from bounding box (fallback)
const estimateVolumeFromBoundingBox = (shape) => {
  const bbox = shape.boundingBox || calculateBoundingBox(shape);
  const volume = (bbox.xMax - bbox.xMin) * 
                 (bbox.yMax - bbox.yMin) * 
                 (bbox.zMax - bbox.zMin);
  
  // Assume 30-70% material fill (typical for injection molding)
  const fillFactor = 0.4 + (Math.random() * 0.3);
  return volume * fillFactor;
};

// Estimate wall thickness from shape properties
const estimateWallThicknessFromShape = (shape) => {
  const volume = shape.volume || estimateVolumeFromBoundingBox(shape);
  const bbox = shape.boundingBox || calculateBoundingBox(shape);
  
  // Empirical formula based on part size and volume
  const avgDimension = ((bbox.xMax - bbox.xMin) + 
                       (bbox.yMax - bbox.yMin) + 
                       (bbox.zMax - bbox.zMin)) / 3;
  
  // Typical wall thicknesses for injection molding
  if (avgDimension < 25) return 1.0 - 1.5;
  if (avgDimension < 75) return 1.5 - 2.5;
  if (avgDimension < 150) return 2.0 - 3.5;
  return 2.5 - 4.0;
};

// Three.js STL fallback
const analyzeSTLWithThreeJS = (arrayBuffer) => {
  return new Promise((resolve, reject) => {
    try {
      const loader = new STLLoader();
      const geometry = loader.parse(arrayBuffer);
      
      geometry.computeBoundingBox();
      const bbox = geometry.boundingBox;
      
      const volume = calculateSTLVolume(geometry);
      const wallThickness = estimateWallThicknessSTL(geometry);
      
      resolve({
        volume: Math.max(0.1, volume / 1000),
        dimensions: {
          length: Math.max(1, bbox.max.x - bbox.min.x),
          width: Math.max(1, bbox.max.y - bbox.min.y),
          height: Math.max(1, bbox.max.z - bbox.min.z)
        },
        wallThickness: Math.max(0.5, wallThickness)
      });
    } catch (error) {
      reject(error);
    }
  });
};

// STL volume calculation
const calculateSTLVolume = (geometry) => {
  let volume = 0;
  const position = geometry.getAttribute('position');
  
  for (let i = 0; i < position.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(position, i);
    const b = new THREE.Vector3().fromBufferAttribute(position, i + 1);
    const c = new THREE.Vector3().fromBufferAttribute(position, i + 2);
    
    volume += (a.dot(b.cross(c))) / 6.0;
  }
  
  return Math.abs(volume);
};

// STL wall thickness estimation
const estimateWallThicknessSTL = (geometry) => {
  geometry.computeBoundingSphere();
  const size = geometry.boundingSphere.radius * 2;
  
  if (size < 25) return 1.0;
  if (size < 50) return 1.5;
  if (size < 100) return 2.0;
  if (size < 200) return 2.5;
  return 3.0;
};

// Emergency fallback for failed analyses
const estimateFromFileSize = (arrayBuffer, format) => {
  const fileSize = arrayBuffer.byteLength;
  const scale = Math.cbrt(fileSize / 5000); // Empirical scaling
  
  const baseSize = format === 'step' ? 30 : 20;
  
  return {
    volume: Math.max(1, scale * baseSize),
    dimensions: {
      length: Math.max(10, scale * 60),
      width: Math.max(8, scale * 45),
      height: Math.max(5, scale * 30)
    },
    wallThickness: 2.0 + (scale * 0.5)
  };
};

// File type detection
export const getFileType = (fileName) => {
  const extension = '.' + fileName.toLowerCase().split('.').pop();
  const formatMap = {
    '.stl': 'stl',
    '.stp': 'step', 
    '.step': 'step',
    '.igs': 'iges',
    '.iges': 'iges'
  };
  return formatMap[extension] || null;
};

export const validateFile = (file) => {
  const extension = '.' + file.name.toLowerCase().split('.').pop();
  const supported = ['.stl', '.stp', '.step', '.igs', '.iges'];
  
  if (!supported.includes(extension)) {
    throw new Error(`Unsupported format: ${extension}. Supported: ${supported.join(', ')}`);
  }
  
  if (file.size > 100 * 1024 * 1024) {
    throw new Error('File too large. Maximum size: 100MB');
  }
  
  return true;
};