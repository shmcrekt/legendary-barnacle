import React, { useState, useCallback } from 'react';
import { analyzeCADFile, validateFile } from '../utils/cadAnalyzer';

const CADAnalyzer = ({ onAnalysisComplete, onError }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState(null);

  const handleFileUpload = useCallback(async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      // Validate file
      validateFile(file);
      setCurrentFile(file.name);
      
      setIsAnalyzing(true);
      setProgress(10);
      
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 300);

      // Analyze CAD file
      setProgress(30);
      const analysis = await analyzeCADFile(file);
      
      clearInterval(progressInterval);
      setProgress(90);
      
      // Notify parent component
      onAnalysisComplete(analysis);
      
      setProgress(100);
      
      // Reset after success
      setTimeout(() => {
        setIsAnalyzing(false);
        setProgress(0);
        setCurrentFile(null);
        event.target.value = '';
      }, 1000);
      
    } catch (error) {
      console.error('CAD analysis error:', error);
      onError(error.message);
      setIsAnalyzing(false);
      setProgress(0);
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
                <strong>Now with REAL STEP/STP support!</strong><br/>
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
              
              <div style={{ marginTop: '1rem' }}>
                <div style={{
                  width: '100%',
                  height: '6px',
                  backgroundColor: '#334155',
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${progress}%`,
                    height: '100%',
                    backgroundColor: '#10b981',
                    transition: 'width 0.3s ease',
                    borderRadius: '3px'
                  }} />
                </div>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                  Progress: {progress}%
                </p>
              </div>
            </>
          )}
        </div>
      </label>
      
      <div className="simulation-notice" style={{ background: '#10b981' }}>
  ✅ REAL CAD ANALYSIS - STL (Exact) + STEP (Enhanced Estimation)
</div>
    </div>
  );
};

export default CADAnalyzer;
