import * as THREE from 'three';
import { STLLoader } from 'three-stdlib';

// Main CAD analysis function
export const analyzeCADFile = async (file) => {
  const fileType = getFileType(file.name);
  
  console.log(`Analyzing ${fileType.toUpperCase()} file:`, file.name);
  
  try {
    let result;
    
    if (fileType === 'stl') {
      // Use accurate Three.js STL parser
      const arrayBuffer = await file.arrayBuffer();
      result = await analyzeSTL(arrayBuffer);
    } else {
      // STEP/other formats → Use our API
      result = await analyzeWithAPI(file);
    }
    
    return {
      ...result,
      format: fileType,
      analyzedLocally: fileType === 'stl',
      fileName: file.name
    };
    
  } catch (error) {
    console.error('CAD analysis failed:', error);
    
    // Final fallback - basic estimation
    const estimated = await analyzeWithEstimation(file);
    return {
      ...estimated,
      format: fileType,
      analyzedLocally: true,
      fileName: file.name,
      note: 'Using estimation after analysis failed'
    };
  }
};

// Analyze with our API
const analyzeWithAPI = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch('/api/forge-analyze', {
    method: 'POST',
    body: formData
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }
  
  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'API analysis failed');
  }
  
  return {
    volume: result.volume,
    dimensions: result.dimensions,
    wallThickness: estimateWallThicknessFromDimensions(result.dimensions),
    accuracy: result.accuracy,
    note: result.note || 'Analyzed via 3D conversion API'
  };
};

// Enhanced estimation when APIs fail
const analyzeWithEstimation = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const fileSize = arrayBuffer.byteLength;
  const isSTEP = file.name.toLowerCase().includes('.stp') || file.name.toLowerCase().includes('.step');
  
  let scale, baseVolume, baseDims;
  
  if (isSTEP) {
    scale = Math.cbrt(fileSize / 50000);
    baseVolume = 60;
    baseDims = { length: 150, width: 110, height: 70 };
  } else {
    scale = Math.cbrt(fileSize / 100000);
    baseVolume = 40;
    baseDims = { length: 120, width: 90, height: 60 };
  }
  
  const volume = Math.max(1, baseVolume * scale);
  const dimensions = {
    length: Math.max(15, baseDims.length * scale),
    width: Math.max(12, baseDims.width * scale),
    height: Math.max(8, baseDims.height * scale)
  };
  
  return {
    volume,
    dimensions,
    wallThickness: estimateWallThicknessFromDimensions(dimensions),
    accuracy: 'estimated',
    note: 'Using enhanced file size estimation'
  };
};

// STL Analysis (this works perfectly)
const analyzeSTL = async (arrayBuffer) => {
  return analyzeSTLWithThreeJS(arrayBuffer);
};

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
        wallThickness: Math.max(0.5, wallThickness),
        accuracy: 'high',
        note: 'Accurate mesh analysis'
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

// Wall thickness from dimensions
const estimateWallThicknessFromDimensions = (dimensions) => {
  const avgSize = (dimensions.length + dimensions.width + dimensions.height) / 3;
  
  if (avgSize < 25) return 1.0;
  if (avgSize < 50) return 1.5;
  if (avgSize < 100) return 2.0;
  if (avgSize < 200) return 2.5;
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
