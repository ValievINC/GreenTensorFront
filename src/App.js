import React, { useState } from 'react';
import axios from 'axios';
import JSZip from 'jszip';
import './App.css';

function App() {
  const [params, setParams] = useState({
    radiusRatio: 10,
    layers_count: 5,
    norm_radii: [0.2, 0.4, 0.6, 0.8, 1],
    dielectric_constants: [1.96, 1.84, 1.64, 1.36, 1],
    magnetic_permeabilities: [1, 1, 1, 1, 1],
    plot_type: "both"
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewImages, setPreviewImages] = useState([]);
  const [zipBlob, setZipBlob] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setParams(prev => ({ 
      ...prev, 
      [name]: name === 'radiusRatio' || name === 'layers_count' ? 
        parseInt(value) || 0 : value 
    }));
  };

  const handleArrayChange = (e, arrayName, index) => {
    const { value } = e.target;
    setParams(prev => ({
      ...prev,
      [arrayName]: prev[arrayName].map((item, i) => 
        i === index ? parseFloat(value) || 0 : item
      )
    }));
  };

  const addLayer = () => {
    setParams(prev => ({
      ...prev,
      layers_count: prev.layers_count + 1,
      norm_radii: [...prev.norm_radii.slice(0, -1), 1, 1],
      dielectric_constants: [...prev.dielectric_constants.slice(0, -1), 1, 1],
      magnetic_permeabilities: [...prev.magnetic_permeabilities.slice(0, -1), 1, 1]
    }));
  };

  const removeLayer = () => {
    if (params.layers_count > 2) {
      setParams(prev => ({
        ...prev,
        layers_count: prev.layers_count - 1,
        norm_radii: [...prev.norm_radii.slice(0, -2), 1],
        dielectric_constants: [...prev.dielectric_constants.slice(0, -2), 1],
        magnetic_permeabilities: [...prev.magnetic_permeabilities.slice(0, -2), 1]
      }));
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setPreviewImages([]);
    setZipBlob(null);

    try {
      const response = await axios.post(
        'http://localhost:8000/generate-images/',
        params,
        { responseType: 'arraybuffer' }
      );

      const blob = new Blob([response.data], { type: 'application/zip' });
      setZipBlob(blob);

      const zip = await JSZip.loadAsync(response.data);
      const imagePromises = [];
      
      zip.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir && zipEntry.name.match(/\.(png|jpg|jpeg)$/i)) {
          imagePromises.push(
            zipEntry.async('base64').then(base64 => ({
              name: zipEntry.name,
              src: `data:image/png;base64,${base64}`
            }))
          );
        }
      });

      const images = await Promise.all(imagePromises);
      setPreviewImages(images);

    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!zipBlob) return;
    
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'lens_images.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Green Tensor Image Generator</h1>
      </header>

      <div className="container">
        <form onSubmit={handleGenerate}>
        <div className="form-group">
            <label>Радиус линзы (radiusRatio):</label>
            <input
              type="number"
              name="radiusRatio"
              value={params.radiusRatio}
              onChange={handleChange}
              min="1"
            />
          </div>

          <div className="form-group">
            <label>Количество слоев (layers_count):</label>
            <div className="layer-controls">
              <button type="button" onClick={removeLayer}>-</button>
              <span>{params.layers_count}</span>
              <button type="button" onClick={addLayer}>+</button>
            </div>
          </div>

          <div className="form-group">
            <label>Тип графика (plot_type):</label>
            <select 
              name="plot_type" 
              value={params.plot_type} 
              onChange={handleChange}
            >
              <option value="both">Оба графика</option>
              <option value="line">Только линейный</option>
              <option value="polar">Только полярный</option>
            </select>
          </div>

          <h3>Параметры слоев:</h3>
          <div className="layers-info">
            <p>Последний слой (воздух) фиксирован</p>
          </div>
          <div className="layers-grid">
            <div className="layer-header">
              <span>Слой</span>
              <span>Радиус</span>
              <span>Диэлектрическая проницаемость</span>
              <span>Магнитная проницаемость</span>
            </div>
            
            {Array.from({ length: params.layers_count }).map((_, i) => {
              const isAirLayer = i === params.layers_count - 1;
              return (
                <div className={`layer-row ${isAirLayer ? 'air-layer' : ''}`} key={i}>
                  <span>
                    {i + 1} 
                    {isAirLayer && <span className="air-label"> (воздух)</span>}
                  </span>
                  <input
                    type="number"
                    value={params.norm_radii[i]}
                    onChange={isAirLayer ? undefined : (e) => handleArrayChange(e, 'norm_radii', i)}
                    step="0.01"
                    min="0"
                    max={isAirLayer ? "1" : "0.999"}
                    readOnly={isAirLayer}
                    className={isAirLayer ? 'read-only' : ''}
                  />
                  <input
                    type="number"
                    value={params.dielectric_constants[i]}
                    onChange={isAirLayer ? undefined : (e) => handleArrayChange(e, 'dielectric_constants', i)}
                    step="0.01"
                    readOnly={isAirLayer}
                    className={isAirLayer ? 'read-only' : ''}
                  />
                  <input
                    type="number"
                    value={params.magnetic_permeabilities[i]}
                    onChange={isAirLayer ? undefined : (e) => handleArrayChange(e, 'magnetic_permeabilities', i)}
                    step="0.01"
                    min="0"
                    readOnly={isAirLayer}
                    className={isAirLayer ? 'read-only' : ''}
                  />
                </div>
              );
            })}
          </div>

          <div className="actions">
            <button type="submit" disabled={loading}>
              {loading ? 'Генерация...' : 'Сгенерировать'}
            </button>
            
            {zipBlob && (
              <button 
                type="button" 
                onClick={handleDownload}
                className="download-btn"
              >
                Скачать ZIP
              </button>
            )}
          </div>

          {error && <div className="error">{error}</div>}
        </form>

        {previewImages.length > 0 && (
          <div className="images-container">
            <h3>Результат:</h3>
            <div className="images-grid">
              {previewImages.map((img, index) => (
                <div key={index} className="image-card">
                  <h4>{img.name.replace('.png', '')}</h4>
                  <img src={img.src} alt={img.name} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;