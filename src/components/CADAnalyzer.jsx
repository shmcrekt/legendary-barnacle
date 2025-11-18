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
      
      <label 
        htmlFor="cad-file" 
        style={{ 
          cursor: isAnalyzing ? 'not-allowed' : 'pointer',
          display: 'block',
          width: '100%',
          height: '100%',
          padding: '2rem'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          {!isAnalyzing ? (
            <>
              {/* Upload Icon */}
              <div style={{ 
                fontSize: '3rem',
                marginBottom: '1rem',
                color: '#3b82f6'
              }}>
                📁
              </div>
              
              <p style={{ 
                fontSize: '1.2rem', 
                marginBottom: '0.5rem',
                fontWeight: '600',
                color: 'var(--text-primary)'
              }}>
                Upload CAD File
              </p>
              
              <p style={{ 
                fontSize: '1rem', 
                color: '#94a3b8', 
                marginBottom: '1.5rem',
                lineHeight: '1.4'
              }}>
                Click anywhere or drag & drop<br/>
                <strong>Supported: .STL, .STEP, .STP</strong>
              </p>
              
              {/* Visual "button" that's not actually a button */}
              <div style={{
                display: 'inline-block',
                background: 'var(--accent-primary)',
                color: 'white',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '1rem',
                transition: 'all 0.2s',
                transform: 'translateY(0)'
              }}>
                Select File
              </div>
            </>
          ) : (
            <>
              {/* Analyzing State */}
              <div style={{ 
                fontSize: '2.5rem',
                marginBottom: '1rem'
              }}>
                ⚙️
              </div>
              
              <p style={{ 
                fontSize: '1.1rem', 
                marginBottom: '0.5rem',
                fontWeight: '600',
                color: 'var(--text-primary)'
              }}>
                Analyzing CAD File
              </p>
              
              <p style={{ 
                fontSize: '0.9rem', 
                color: '#94a3b8', 
                marginBottom: '1.5rem'
              }}>
                {currentFile}
              </p>
              
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: '0.75rem'
              }}>
                <div style={{ 
                  width: '20px', 
                  height: '20px', 
                  border: '2px solid #3b82f6',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>
                  Processing {currentFile?.split('.').pop()?.toUpperCase()}...
                </span>
              </div>
            </>
          )}
        </div>
      </label>
      
      <div className="simulation-notice" style={{ background: '#10b981', marginTop: '0' }}>
        ✅ REAL-TIME CAD ANALYSIS - Click Anywhere to Upload
      </div>
    </div>
  );
};

export default CADAnalyzer;
