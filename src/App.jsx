import React, { useState, useCallback } from 'react';
import CADAnalyzer from './components/CADAnalyzer';

// Database and Rules based on industry research
const RESINS = [
  { 
    id: 1, 
    name: 'Polypropylene (PP)', 
    density: 0.905, 
    costPerKg: 1.80,
    description: 'Excellent chemical resistance, low cost'
  },
  { 
    id: 2, 
    name: 'ABS', 
    density: 1.04, 
    costPerKg: 2.40,
    description: 'Good impact strength, great surface finish'
  },
  { 
    id: 3, 
    name: 'Polycarbonate (PC)', 
    density: 1.20, 
    costPerKg: 4.20,
    description: 'High strength, transparent, heat resistant'
  }
];

const COLOR_OPTIONS = [
  { id: 'natural', name: 'Natural (No additional cost)', premium: 0.00 },
  { id: 'black', name: 'Black (+5% material cost)', premium: 0.05 },
  { id: 'red', name: 'Red (+10% material cost)', premium: 0.10 }
];

const MACHINES = [
  { id: 1, name: 'Small Press (50T)', clampForce: 50, hourlyRate: 65, maxMoldWidth: 300, maxMoldHeight: 300 },
  { id: 2, name: 'Medium Press (150T)', clampForce: 150, hourlyRate: 85, maxMoldWidth: 450, maxMoldHeight: 450 },
  { id: 3, name: 'Large Press (300T)', clampForce: 300, hourlyRate: 120, maxMoldWidth: 600, maxMoldHeight: 600 }
];

const RULES = {
  moldBaseMultiplier: 2.5,
  cycleTimeBase: 25,
  cycleTimePerMM: 1.5,
  scrapRate: 0.05,
  minCycleTime: 15,
  cavitySpacing: 1.5
};

function App() {
  const [partData, setPartData] = useState({
    volume: 50,
    length: 100,
    width: 80,
    height: 60,
    wallThickness: 2.5
  });
  
  const [selectedResin, setSelectedResin] = useState(1);
  const [selectedColor, setSelectedColor] = useState('natural');
  const [cavities, setCavities] = useState(1);
  const [analysisError, setAnalysisError] = useState(null);

  const calculateQuote = useCallback(() => {
    const resin = RESINS.find(r => r.id === selectedResin);
    const color = COLOR_OPTIONS.find(c => c.id === selectedColor);
    
    if (!resin || !color) return null;

    // Material Calculations
    const materialWeight = partData.volume * resin.density;
    const rawMaterialCost = materialWeight * resin.costPerKg / 1000;
    const colorCost = rawMaterialCost * color.premium;
    const totalMaterialCost = rawMaterialCost + colorCost;

    // Mold Size Estimation
    const moldWidth = partData.width * RULES.moldBaseMultiplier * (cavities > 1 ? RULES.cavitySpacing : 1);
    const moldHeight = partData.height * RULES.moldBaseMultiplier;

    // Machine Selection
    const suitableMachine = MACHINES
      .filter(machine => machine.maxMoldWidth >= moldWidth && machine.maxMoldHeight >= moldHeight)
      .sort((a, b) => a.clampForce - b.clampForce)[0] || MACHINES[MACHINES.length - 1];

    // Cycle Time Estimation
    const baseCycleTime = RULES.cycleTimeBase + (partData.wallThickness * RULES.cycleTimePerMM);
    const cycleTime = Math.max(baseCycleTime, RULES.minCycleTime);
    const partsPerHour = (3600 / cycleTime) * cavities;
    const machineCostPerPart = suitableMachine.hourlyRate / partsPerHour;

    // Final Cost Calculation
    const costBeforeScrap = totalMaterialCost + machineCostPerPart;
    const totalCostPerPart = costBeforeScrap * (1 + RULES.scrapRate);

    return {
      materialWeight,
      rawMaterialCost,
      colorCost,
      totalMaterialCost,
      moldSize: { width: moldWidth, height: moldHeight },
      selectedMachine: suitableMachine,
      cycleTime,
      partsPerHour,
      machineCostPerPart,
      totalCostPerPart,
      selectedResin: resin,
      selectedColor: color
    };
  }, [partData, selectedResin, selectedColor, cavities]);

  const handleAnalysisComplete = useCallback((analysis) => {
    setPartData({
      volume: analysis.volume,
      length: analysis.dimensions.length,
      width: analysis.dimensions.width,
      height: analysis.dimensions.height,
      wallThickness: analysis.wallThickness
    });
    setAnalysisError(null);
  }, []);

  const handleAnalysisError = useCallback((error) => {
    setAnalysisError(error);
  }, []);

  const handlePartDataChange = (field, value) => {
    setPartData(prev => ({
      ...prev,
      [field]: parseFloat(value) || 0
    }));
  };

  const results = calculateQuote();

  if (!results) {
    return React.createElement('div', { className: 'container' }, 'Loading...');
  }

  return React.createElement('div', { className: 'container' },
    // LEFT SIDE - INPUTS
    React.createElement('div', { className: 'card' },
      React.createElement('h2', null, 'Part Information'),
      
      React.createElement(CADAnalyzer, {
        onAnalysisComplete: handleAnalysisComplete,
        onError: handleAnalysisError
      }),
      
      analysisError && React.createElement('div', { 
        style: { 
          background: 'var(--error)',
          color: 'white',
          padding: '0.75rem',
          borderRadius: '6px',
          marginBottom: '1rem',
          fontSize: '0.9rem'
        } 
      }, `Analysis Error: ${analysisError}`),

      React.createElement('div', { className: 'form-group' },
        React.createElement('label', null, 'Part Volume (cm³)'),
        React.createElement('input', {
          type: 'number',
          value: partData.volume,
          onChange: (e) => handlePartDataChange('volume', e.target.value),
          step: '0.1',
          min: '0'
        })
      ),

      React.createElement('div', { className: 'dimensions-grid' },
        React.createElement('div', { className: 'form-group' },
          React.createElement('label', null, 'Length (mm)'),
          React.createElement('input', {
            type: 'number',
            value: partData.length,
            onChange: (e) => handlePartDataChange('length', e.target.value),
            step: '1',
            min: '0'
          })
        ),
        React.createElement('div', { className: 'form-group' },
          React.createElement('label', null, 'Width (mm)'),
          React.createElement('input', {
            type: 'number',
            value: partData.width,
            onChange: (e) => handlePartDataChange('width', e.target.value),
            step: '1',
            min: '0'
          })
        ),
        React.createElement('div', { className: 'form-group' },
          React.createElement('label', null, 'Height (mm)'),
          React.createElement('input', {
            type: 'number',
            value: partData.height,
            onChange: (e) => handlePartDataChange('height', e.target.value),
            step: '1',
            min: '0'
          })
        )
      ),

      React.createElement('div', { className: 'form-group' },
        React.createElement('label', null, 'Wall Thickness (mm)'),
        React.createElement('input', {
          type: 'number',
          value: partData.wallThickness,
          onChange: (e) => handlePartDataChange('wallThickness', e.target.value),
          step: '0.1',
          min: '0.1'
        })
      ),

      React.createElement('div', { className: 'form-group' },
        React.createElement('label', null, 'Resin Material'),
        React.createElement('select', { 
          value: selectedResin, 
          onChange: (e) => setSelectedResin(parseInt(e.target.value))
        },
          RESINS.map(resin => 
            React.createElement('option', { key: resin.id, value: resin.id },
              `${resin.name} - $${resin.costPerKg}/kg`
            )
          )
        ),
        React.createElement('p', { style: { fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.5rem' } },
          results.selectedResin.description
        )
      ),

      React.createElement('div', { className: 'form-group' },
        React.createElement('label', null, 'Color'),
        React.createElement('select', { 
          value: selectedColor, 
          onChange: (e) => setSelectedColor(e.target.value)
        },
          COLOR_OPTIONS.map(color => 
            React.createElement('option', { key: color.id, value: color.id },
              color.name
            )
          )
        )
      ),

      React.createElement('div', { className: 'form-group' },
        React.createElement('label', null, 'Number of Cavities'),
        React.createElement('select', { 
          value: cavities, 
          onChange: (e) => setCavities(parseInt(e.target.value))
        },
          React.createElement('option', { value: 1 }, '1 Cavity'),
          React.createElement('option', { value: 2 }, '2 Cavities'),
          React.createElement('option', { value: 4 }, '4 Cavities'),
          React.createElement('option', { value: 8 }, '8 Cavities')
        )
      )
    ),

    // RIGHT SIDE - RESULTS
    React.createElement('div', null,
      // Final Quote at the top of right column
      React.createElement('div', { className: 'final-quote' },
        React.createElement('h2', null, 'Cost Per Part'),
        React.createElement('div', null,
          React.createElement('span', { className: 'price' }, `$${results.totalCostPerPart.toFixed(4)}`),
          React.createElement('span', { className: 'unit' }, '/part')
        ),
        React.createElement('p', { style: { color: 'rgba(255,255,255,0.8)', marginTop: '1rem', fontSize: '0.9rem' } },
          `Based on ${cavities} cavity mold with ${results.selectedResin.name}`
        )
      ),

      // Production Analysis below the quote
      React.createElement('div', { className: 'card' },
        React.createElement('h2', null, 'Production Analysis'),
        
        React.createElement('div', { className: 'results-grid' },
          React.createElement('div', { className: 'result-item' },
            React.createElement('h3', null, 'Material Weight'),
            React.createElement('div', null,
              React.createElement('span', { className: 'value' }, results.materialWeight.toFixed(1)),
              React.createElement('span', { className: 'unit' }, 'g')
            )
          ),

          React.createElement('div', { className: 'result-item' },
            React.createElement('h3', null, 'Selected Resin'),
            React.createElement('div', null,
              React.createElement('span', { className: 'value' }, results.selectedResin.name)
            )
          ),

          React.createElement('div', { className: 'result-item' },
            React.createElement('h3', null, 'Mold Size'),
            React.createElement('div', null,
              React.createElement('span', { className: 'value' }, results.moldSize.width.toFixed(0)),
              React.createElement('span', { className: 'unit' }, `× ${results.moldSize.height.toFixed(0)}mm`)
            )
          ),

          React.createElement('div', { className: 'result-item' },
            React.createElement('h3', null, 'Selected Color'),
            React.createElement('div', null,
              React.createElement('span', { className: 'value' }, results.selectedColor.name.split(' (')[0])
            )
          ),

          React.createElement('div', { className: 'result-item' },
            React.createElement('h3', null, 'Cycle Time'),
            React.createElement('div', null,
              React.createElement('span', { className: 'value' }, results.cycleTime.toFixed(1)),
              React.createElement('span', { className: 'unit' }, 's')
            )
          ),

          React.createElement('div', { className: 'result-item' },
            React.createElement('h3', null, 'Parts Per Hour'),
            React.createElement('div', null,
              React.createElement('span', { className: 'value' }, results.partsPerHour.toFixed(0)),
              React.createElement('span', { className: 'unit' }, '/hr')
            )
          ),

          React.createElement('div', { className: 'result-item' },
            React.createElement('h3', null, 'Machine'),
            React.createElement('div', null,
              React.createElement('span', { className: 'value' }, results.selectedMachine.name)
            )
          ),

          React.createElement('div', { className: 'result-item' },
            React.createElement('h3', null, 'Machine Rate'),
            React.createElement('div', null,
              React.createElement('span', { className: 'value' }, `$${results.selectedMachine.hourlyRate}`),
              React.createElement('span', { className: 'unit' }, '/hr')
            )
          )
        ),

        React.createElement('div', { className: 'breakdown' },
          React.createElement('h3', null, 'Cost Breakdown'),
          React.createElement('div', { className: 'breakdown-item' },
            React.createElement('span', { className: 'label' }, 'Raw Material Cost'),
            React.createElement('span', { className: 'value' }, `$${results.rawMaterialCost.toFixed(4)}`)
          ),
          results.selectedColor.premium > 0 && React.createElement('div', { className: 'breakdown-item' },
            React.createElement('span', { className: 'label' }, `Color Premium`),
            React.createElement('span', { className: 'value' }, `+$${results.colorCost.toFixed(4)}`)
          ),
          React.createElement('div', { className: 'breakdown-item' },
            React.createElement('span', { className: 'label' }, 'Machine Time'),
            React.createElement('span', { className: 'value' }, `$${results.machineCostPerPart.toFixed(4)}`)
          ),
          React.createElement('div', { className: 'breakdown-item' },
            React.createElement('span', { className: 'label' }, `Scrap Factor (${RULES.scrapRate * 100}%)`),
            React.createElement('span', { className: 'value' }, `+$${(results.totalCostPerPart - (results.totalMaterialCost + results.machineCostPerPart)).toFixed(4)}`)
          )
        )
      )
    )
  );
}

export default App;