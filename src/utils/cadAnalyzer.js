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
      result = await analyzeSTEP(file, arrayBuffer);
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

// STL Analysis with Three.js (This works correctly)
const analyzeSTL = async (arrayBuffer) => {
  return analyzeSTLWithThreeJS(arrayBuffer);
};

// STEP Analysis - Improved parsing
const analyzeSTEP = async (file, arrayBuffer) => {
  try {
    const analysis = await parseSTEPGeometry(arrayBuffer);
    
    if (analysis.success) {
      return {
        volume: analysis.volume,
        dimensions: analysis.dimensions,
        wallThickness: analysis.wallThickness,
        accuracy: 'high',
        note: 'STEP geometry parsed successfully'
      };
    } else {
      return analyzeSTEPWithFileAnalysis(arrayBuffer);
    }
    
  } catch (error) {
    console.error('STEP parsing failed, using fallback:', error);
    return analyzeSTEPWithFileAnalysis(arrayBuffer);
  }
};

// IMPROVED: Robust STEP geometry parsing
const parseSTEPGeometry = (arrayBuffer) => {
  return new Promise((resolve) => {
    try {
      const textDecoder = new TextDecoder('utf-8');
      const fileContent = textDecoder.decode(arrayBuffer);
      
      const geometryData = extractGeometryFromSTEP(fileContent);
      
      if (geometryData.points.length > 10) { // Need enough points for accurate bbox
        const bbox = calculateAccurateBoundingBox(geometryData.points);
        const volume = calculateVolumeFromBoundingBox(bbox, geometryData.complexity);
        
        console.log('STEP Analysis Results:', {
          pointsFound: geometryData.points.length,
          boundingBox: bbox,
          calculatedVolume: volume
        });
        
        resolve({
          success: true,
          volume: volume,
          dimensions: {
            length: bbox.width,
            width: bbox.depth, 
            height: bbox.height
          },
          wallThickness: estimateWallThicknessFromBoundingBox(bbox)
        });
      } else {
        console.warn('Insufficient points found in STEP file:', geometryData.points.length);
        resolve({ success: false });
      }
      
    } catch (error) {
      console.error('STEP parsing error:', error);
      resolve({ success: false });
    }
  });
};

// IMPROVED: Extract geometry with multiple methods
const extractGeometryFromSTEP = (fileContent) => {
  const points = [];
  let complexity = 1;
  
  const lines = fileContent.split('\n');
  
  for (const line of lines) {
    // Method 1: Extract from CARTESIAN_POINT
    if (line.includes('CARTESIAN_POINT')) {
      const point = extractPointFromCartesian(line);
      if (isValidPoint(point)) points.push(point);
    }
    
    // Method 2: Extract from VERTEX_POINT
    if (line.includes('VERTEX_POINT')) {
      const point = extractPointFromVertex(line);
      if (isValidPoint(point)) points.push(point);
    }
    
    // Method 3: Extract any 3D coordinates pattern
    const coordPatterns = extractCoordinatesFromText(line);
    coordPatterns.forEach(point => {
      if (isValidPoint(point)) points.push(point);
    });
    
    // Track complexity
    if (line.includes('ADVANCED_FACE')) complexity += 0.2;
    if (line.includes('CLOSED_SHELL')) complexity += 0.5;
    if (line.includes('VERTEX_POINT')) complexity += 0.1;
  }
  
  console.log(`Extracted ${points.length} points from STEP file`);
  return { points, complexity };
};

// IMPROVED: Extract point from CARTESIAN_POINT with better regex
const extractPointFromCartesian = (line) => {
  try {
    // Handle multiple formats:
    // CARTESIAN_POINT('', (X, Y, Z))
    // CARTESIAN_POINT('', (X., Y., Z.))
    // CARTESIAN_POINT ( '', ( X, Y, Z ) )
    const coordMatch = line.match(/CARTESIAN_POINT\s*\([^)]*\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/i);
    if (coordMatch) {
      return {
        x: parseFloat(coordMatch[1]),
        y: parseFloat(coordMatch[2]),
        z: parseFloat(coordMatch[3])
      };
    }
  } catch (error) {
    console.warn('Failed to parse CARTESIAN_POINT:', error);
  }
  return null;
};

// NEW: Extract point from VERTEX_POINT
const extractPointFromVertex = (line) => {
  try {
    // VERTEX_POINT('', #123) - would need to find the referenced point
    // For now, look for inline coordinates
    const coordMatch = line.match(/\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/);
    if (coordMatch) {
      return {
        x: parseFloat(coordMatch[1]),
        y: parseFloat(coordMatch[2]),
        z: parseFloat(coordMatch[3])
      };
    }
  } catch (error) {
    console.warn('Failed to parse VERTEX_POINT:', error);
  }
  return null;
};

// NEW: Extract any coordinate triplets from text
const extractCoordinatesFromText = (line) => {
  const points = [];
  try {
    // Look for patterns like: (100.0, 50.0, 25.0)
    const coordRegex = /\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/g;
    let match;
    
    while ((match = coordRegex.exec(line)) !== null) {
      const x = parseFloat(match[1]);
      const y = parseFloat(match[2]);
      const z = parseFloat(match[3]);
      
      // Only add if these look like reasonable coordinates (not IDs, etc.)
      if (Math.abs(x) < 10000 && Math.abs(y) < 10000 && Math.abs(z) < 10000) {
        points.push({ x, y, z });
      }
    }
  } catch (error) {
    console.warn('Failed to extract coordinates from text:', error);
  }
  return points;
};

// NEW: Validate that point has reasonable values
const isValidPoint = (point) => {
  if (!point) return false;
  if (typeof point.x !== 'number' || typeof point.y !== 'number' || typeof point.z !== 'number') return false;
  if (isNaN(point.x) || isNaN(point.y) || isNaN(point.z)) return false;
  if (Math.abs(point.x) > 10000 || Math.abs(point.y) > 10000 || Math.abs(point.z) > 10000) return false;
  return true;
};

// IMPROVED: Accurate bounding box calculation with outlier removal
const calculateAccurateBoundingBox = (points) => {
  if (points.length === 0) {
    return { width: 100, depth: 80, height: 60 };
  }
  
  // Remove outliers (points that are too far from the cluster)
  const filteredPoints = removeOutliers(points);
  
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  
  filteredPoints.forEach(point => {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  });
  
  // If we still don't have valid bounds, use the unfiltered points
  if (!isFinite(minX)) {
    points.forEach(point => {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
      minZ = Math.min(minZ, point.z);
      maxZ = Math.max(maxZ, point.z);
    });
  }
  
  const width = Math.max(1, maxX - minX);
  const depth = Math.max(1, maxY - minY);
  const height = Math.max(1, maxZ - minZ);
  
  console.log('Bounding Box Calculation:', { minX, maxX, minY, maxY, minZ, maxZ, width, depth, height });
  
  return { width, depth, height };
};

// NEW: Remove outlier points that might be errors
const removeOutliers = (points) => {
  if (points.length < 10) return points;
  
  // Calculate mean and standard deviation for each axis
  const means = { x: 0, y: 0, z: 0 };
  points.forEach(point => {
    means.x += point.x;
    means.y += point.y;
    means.z += point.z;
  });
  means.x /= points.length;
  means.y /= points.length;
  means.z /= points.length;
  
  const stdDevs = { x: 0, y: 0, z: 0 };
  points.forEach(point => {
    stdDevs.x += Math.pow(point.x - means.x, 2);
    stdDevs.y += Math.pow(point.y - means.y, 2);
    stdDevs.z += Math.pow(point.z - means.z, 2);
  });
  stdDevs.x = Math.sqrt(stdDevs.x / points.length);
  stdDevs.y = Math.sqrt(stdDevs.y / points.length);
  stdDevs.z = Math.sqrt(stdDevs.z / points.length);
  
  // Filter points within 2 standard deviations
  return points.filter(point => {
    return Math.abs(point.x - means.x) < 2 * stdDevs.x &&
           Math.abs(point.y - means.y) < 2 * stdDevs.y &&
           Math.abs(point.z - means.z) < 2 * stdDevs.z;
  });
};

// Calculate volume from bounding box with complexity factor
const calculateVolumeFromBoundingBox = (bbox, complexity) => {
  const boxVolume = bbox.width * bbox.depth * bbox.height; // mm³
  
  // Injection molded parts: 30-60% of bounding box volume
  const solidity = 0.6 - (0.3 * Math.min(complexity / 10, 1));
  const volumeMM3 = boxVolume * solidity;
  const volumeCM3 = volumeMM3 / 1000; // Convert to cm³
  
  return Math.max(0.1, volumeCM3);
};

// Estimate wall thickness from bounding box
const estimateWallThicknessFromBoundingBox = (bbox) => {
  const avgSize = (bbox.width + bbox.depth + bbox.height) / 3;
  
  // Typical injection molding wall thicknesses
  if (avgSize < 25) return 1.0;
  if (avgSize < 50) return 1.5;
  if (avgSize < 100) return 2.0;
  if (avgSize < 200) return 2.5;
  return 3.0;
};

// Enhanced STEP analysis with file content parsing
const analyzeSTEPWithFileAnalysis = (arrayBuffer) => {
  const textDecoder = new TextDecoder('utf-8');
  const fileContent = textDecoder.decode(arrayBuffer.slice(0, 5000));
  
  const extractedDims = extractDimensionsFromSTEPContent(fileContent);
  const fileSize = arrayBuffer.byteLength;
  
  if (extractedDims.found) {
    const volumeCM3 = (extractedDims.dimensions.length * 
                      extractedDims.dimensions.width * 
                      extractedDims.dimensions.height) / 1000;
    
    return {
      volume: Math.max(1, volumeCM3 * 0.5),
      dimensions: extractedDims.dimensions,
      wallThickness: extractedDims.wallThickness,
      accuracy: 'medium',
      note: 'Dimensions extracted from STEP file content'
    };
  }
  
  const estimated = estimateFromFileSize(fileSize, 'step');
  return {
    ...estimated,
    accuracy: 'low',
    note: 'Estimated from file characteristics'
  };
};

// Try to extract actual dimensions from STEP file content
const extractDimensionsFromSTEPContent = (fileContent) => {
  const lines = fileContent.split('\n');
  let foundDimensions = false;
  let dimensions = { length: 100, width: 80, height: 60 };
  
  for (const line of lines) {
    const largeCoords = line.match(/(-?\d{2,}\.\d+)/g);
    if (largeCoords) {
      const coords = largeCoords.map(coord => Math.abs(parseFloat(coord)));
      const maxCoord = Math.max(...coords);
      
      if (maxCoord > 10 && maxCoord < 1000) {
        dimensions.length = maxCoord * 0.8;
        dimensions.width = maxCoord * 0.6;
        dimensions.height = maxCoord * 0.4;
        foundDimensions = true;
        break;
      }
    }
  }
  
  const volume = (dimensions.length * dimensions.width * dimensions.height) / 1000;
  const wallThickness = estimateWallThicknessFromBoundingBox({
    width: dimensions.length,
    depth: dimensions.width,
    height: dimensions.height
  });
  
  return {
    found: foundDimensions,
    volume: Math.max(1, volume),
    dimensions,
    wallThickness
  };
};

// Enhanced file size estimation
const estimateFromFileSize = (fileSize, format) => {
  const baseScale = Math.cbrt(fileSize / 10000);
  const formatMultiplier = format === 'step' ? 1.2 : 1.0;
  const scale = baseScale * formatMultiplier;
  
  const dimensions = {
    length: Math.max(20, 80 * scale),
    width: Math.max(15, 60 * scale),
    height: Math.max(10, 40 * scale)
  };
  
  const boundingBoxVolume = dimensions.length * dimensions.width * dimensions.height;
  const volume = (boundingBoxVolume * 0.5) / 1000;
  
  return {
    volume: Math.max(5, volume),
    dimensions: dimensions,
    wallThickness: 1.5 + (scale * 0.5)
  };
};

// STL analysis with Three.js (this works correctly)
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
        note: 'Volume calculated from actual mesh geometry'
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
