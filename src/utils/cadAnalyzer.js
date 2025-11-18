import * as THREE from 'three';
import { STLLoader } from 'three-stdlib';

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

// STL Analysis with Three.js
const analyzeSTL = async (arrayBuffer) => {
  return analyzeSTLWithThreeJS(arrayBuffer);
};

// STEP Analysis - Enhanced estimation
const analyzeSTEP = async (arrayBuffer) => {
  // For now, use enhanced estimation based on file analysis
  // Next week we can add real STEP parsing
  return analyzeSTEPWithEstimation(arrayBuffer);
};

// Enhanced STL analysis with Three.js
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
        volume: Math.max(0.1, volume / 1000), // Convert mm³ to cm³
        dimensions: {
          length: Math.max(1, bbox.max.x - bbox.min.x),
          width: Math.max(1, bbox.max.y - bbox.min.y),
          height: Math.max(1, bbox.max.z - bbox.min.z)
        },
        wallThickness: Math.max(0.5, wallThickness),
        accuracy: 'high' // STL files have high accuracy
      });
    } catch (error) {
      reject(error);
    }
  });
};

// Enhanced STEP analysis with file parsing
const analyzeSTEPWithEstimation = (arrayBuffer) => {
  // Parse STEP file header to get better estimates
  const textDecoder = new TextDecoder('utf-8');
  const fileContent = textDecoder.decode(arrayBuffer.slice(0, 1000)); // Read first 1KB
  
  let estimatedSize = estimateFromFileContent(fileContent);
  const fileSize = arrayBuffer.byteLength;
  
  // Refine estimate based on actual file size
  if (fileSize > 500000) { // Large file > 500KB
    estimatedSize.volume *= 1.5;
    estimatedSize.dimensions.length *= 1.3;
    estimatedSize.dimensions.width *= 1.3;
    estimatedSize.dimensions.height *= 1.3;
  }
  
  return {
    volume: Math.max(1, estimatedSize.volume),
    dimensions: {
      length: Math.max(10, estimatedSize.dimensions.length),
      width: Math.max(8, estimatedSize.dimensions.width),
      height: Math.max(5, estimatedSize.dimensions.height)
    },
    wallThickness: estimatedSize.wallThickness,
    accuracy: 'medium', // STEP files have medium accuracy with estimation
    note: 'STEP analysis uses file structure estimation. Real geometry parsing coming soon!'
  };
};

// Parse STEP file header for better estimates
const estimateFromFileContent = (fileContent) => {
  // Look for clues in STEP file header
  const lines = fileContent.split('\n');
  let complexity = 1;
  
  for (const line of lines) {
    if (line.includes('CARTESIAN_POINT') || line.includes('VERTEX_POINT')) {
      complexity += 0.1;
    }
    if (line.includes('ADVANCED_FACE') || line.includes('CLOSED_SHELL')) {
      complexity += 0.5;
    }
  }
  
  const scale = Math.cbrt(complexity);
  
  return {
    volume: 25 * scale,
    dimensions: {
      length: 80 * scale,
      width: 60 * scale,
      height: 40 * scale
    },
    wallThickness: 2.0 + (scale * 0.3)
  };
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
