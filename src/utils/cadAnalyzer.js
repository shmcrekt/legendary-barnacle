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
      // STEP/other formats → Use Autodesk Forge
      result = await analyzeWithForge(file);
    }
    
    return {
      ...result,
      format: fileType,
      analyzedLocally: fileType === 'stl',
      fileName: file.name
    };
    
  } catch (error) {
    console.error('CAD analysis failed:', error);
    throw new Error(`Failed to analyze ${fileType.toUpperCase()} file: ${error.message}`);
  }
};

// Analyze with Autodesk Forge (Professional accuracy)
const analyzeWithForge = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  console.log('Sending to Autodesk Forge for professional analysis...');
  
  const response = await fetch('/api/forge-analyze', {
    method: 'POST',
    body: formData
  });
  
  if (!response.ok) {
    throw new Error(`Forge API error: ${response.statusText}`);
  }
  
  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'Forge analysis failed');
  }
  
  return {
    volume: result.volume,
    dimensions: result.dimensions,
    wallThickness: estimateWallThicknessFromDimensions(result.dimensions),
    accuracy: result.accuracy,
    note: result.note || 'Professionally analyzed by Autodesk Forge'
  };
};

// STL Analysis with Three.js (Local, accurate)
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
        volume: Math.max(0.1, volume / 1000), // Convert mm³ to cm³
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

// Wall thickness from dimensions (for Forge results)
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
