import React, { useState, useEffect } from 'react';
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
  const [images, setImages] = useState([]);
  const [downloadUrl, setDownloadUrl] = useState(null);

  // Очистка Blob URL при размонтировании
  useEffect(() => {
    return () => {
      images.forEach(image => URL.revokeObjectURL(image.url));
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [images, downloadUrl]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setImages([]);
    setDownloadUrl(null);

    try {
      const response = await axios.post(
        'http://localhost:8000/generate-images/',
        params,
        { responseType: 'arraybuffer' }
      );

      // Создаем URL для скачивания
      const url = window.URL.createObjectURL(new Blob([response.data]));
      setDownloadUrl(url);

      // Распаковываем ZIP
      const zip = await JSZip.loadAsync(response.data);
      const imagePromises = [];
      
      zip.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir && zipEntry.name.match(/\.(png|jpg|jpeg)$/i)) {
          imagePromises.push(
            zipEntry.async('blob').then(blob => ({
              name: zipEntry.name,
              url: URL.createObjectURL(blob)
            }))
          );
        }
      });

      const extractedImages = await Promise.all(imagePromises);
      setImages(extractedImages);

    } catch (err) {
      let errorMessage = 'Произошла ошибка';
      
      if (err.response?.data) {
        try {
          // Пытаемся распарсить ошибку как JSON
          const decoder = new TextDecoder('utf-8');
          const errorData = JSON.parse(decoder.decode(new Uint8Array(err.response.data)));
          errorMessage = errorData.detail?.error || errorData.detail?.message || errorMessage;
        } catch {
          errorMessage = err.message;
        }
      } else {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Green Tensor Image Generator</h1>
      </header>

      <div className="container">
        <form onSubmit={handleSubmit}>
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

          <button type="submit" disabled={loading}>
            {loading ? 'Генерация...' : 'Сгенерировать изображения'}
          </button>

          {error && (
            <div className="error">
              <strong>Ошибка:</strong>
              <div>{error}</div>
            </div>
          )}

          {downloadUrl && (
            <div className="download-section">
              <a
                href={downloadUrl}
                download="lens_images.zip"
                className="download-btn"
              >
                Скачать ZIP с изображениями
              </a>
            </div>
          )}

          {images.length > 0 && (
            <div className="images-container">
              <h3>Результаты:</h3>
              <div className="images-grid">
                {images.map((image, index) => (
                  <div key={index} className="image-card">
                    <h4>{image.name.replace('.png', '').replace('lens_', '')}</h4>
                    <img 
                      src={image.url} 
                      alt={image.name} 
                      className="generated-image"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default App;