import React, { useState, useCallback } from 'react';
import { analyzeCADFile, validateFile } from '../utils/cadAnalyzer';

const CADAnalyzer = ({ onAnalysisComplete, onError }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentFile, setCurrentFile] = useState(null);

  const handleFileUpload = useCallback(async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      // Validate file
      validateFile(file);
      setCurrentFile(file.name);
      setIsAnalyzing(true);

      // Analyze CAD file - NO ARTIFICIAL DELAYS!
      const analysis = await analyzeCADFile(file);
      
      // Notify parent component immediately
      onAnalysisComplete(analysis);
      
      // Reset
      setIsAnalyzing(false);
      setCurrentFile(null);
      event.target.value = ''; // Reset file input
      
    } catch (error) {
      console.error('CAD analysis error:', error);
      onError(error.message);
      setIsAnalyzing(false);
      setCurrentFile(null);
    }
  }, [onAnalysisComplete, onError]);

  return (
    <div className="upload-area">
      <input
        type="file"
        id="cad-file"
        accept=".stl,.stp,.step,.igs,.iges"
        onChange={handleFileUpload}
        disabled={isAnalyzing}
        style={{ display: 'none' }}
      />
      
      <label htmlFor="cad-file" style={{ 
        cursor: isAnalyzing ? 'not-allowed' : 'pointer',
        display: 'block',
        width: '100%',
        height: '100%'
      }}>
        <div style={{ textAlign: 'center', padding: isAnalyzing ? '1.5rem' : '2rem' }}>
          {!isAnalyzing ? (
            <>
              <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Upload 3D CAD File</p>
              <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '1rem' }}>
                <strong>Real-time CAD Analysis</strong><br/>
                Supported: .STL, .STEP, .STP, .IGES
              </p>
              
              <button className="upload-button">
                Choose CAD File
              </button>
            </>
          ) : (
            <>
              <p style={{ fontSize: '1rem', marginBottom: '1rem' }}>
                Analyzing: <strong>{currentFile}</strong>
              </p>
              
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: '1rem',
                marginBottom: '1rem'
              }}>
                <div style={{ 
                  width: '20px', 
                  height: '20px', 
                  border: '2px solid #3b82f6',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                <span>Processing {currentFile?.split('.').pop()?.toUpperCase()}...</span>
              </div>
              
              <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Analyzing geometry in real-time...
              </p>
            </>
          )}
        </div>
      </label>
      
      <div className="simulation-notice" style={{ background: '#10b981' }}>
        ✅ REAL-TIME CAD ANALYSIS - No Artificial Delays
      </div>
    </div>
  );
};

export default CADAnalyzer;
