import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { UserContext } from '../../App';
import logo from "../../assets/img/logoAguida.png";
import './css/pendiente.css';
import Navigation from '../Navigation/narbar';
import Fotos from './Foto'; 
import { Button } from 'semantic-ui-react';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';

const Pendientes = () => {
    const { userData } = useContext(UserContext);
    const [datos, setDatos] = useState([]);
    const [hiddenDurations, setHiddenDurations] = useState([]);
    const [selectedCheckboxes, setSelectedCheckboxes] = useState({});
    const [percentages, setPercentages] = useState({});
    const [modalOpen, setModalOpen] = useState(false); 
    const [selectedField, setSelectedField] = useState(null); 
    const [capturedPhotos, setCapturedPhotos] = useState({}); 

    const checkboxValues = {
        'Conforme': 1,
        'm': 0.7,
        'M': 0.3,
        'C': 0,
        'NA': null
    };

    useEffect(() => {
        const obtenerFechaInicio = (duracion) => {
            const partes = duracion.split(" ");

            let diaInicio = 1;
            let mesInicio = 0;
            let anoInicio = new Date().getFullYear();

            for (const parte of partes) {
                const numero = parseInt(parte);
                if (!isNaN(numero)) {
                    diaInicio = numero;
                } else if (parte.length === 4 && !isNaN(parseInt(parte))) {
                    anoInicio = parseInt(parte);
                } else {
                    mesInicio = obtenerNumeroMes(parte);
                    if (mesInicio !== -1) break;
                }
            }

            return new Date(anoInicio, mesInicio, diaInicio);
        };

        const obtenerDatos = async () => {
            try {
                const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/datos`);
                if (userData && userData.Correo) {
                    const datosFiltrados = response.data.filter((dato) => 
                        dato.AuditorLiderEmail === userData.Correo && dato.Estado === "pendiente"
                    );

                // Ordena los datos por duración de manera ascendente
                datosFiltrados.sort((a, b) => {
                    const fechaInicioA = obtenerFechaInicio(a.Duracion);
                    const fechaInicioB = obtenerFechaInicio(b.Duracion);

                    // Primero, comparamos las fechas de inicio
                    if (fechaInicioA < fechaInicioB) return -1;
                    if (fechaInicioA > fechaInicioB) return 1;
                    return 0; // Si ambas fechas de inicio y fin son iguales
                });

                setDatos(datosFiltrados);
            } else {
                console.log('userData o userData.Correo no definidos:', userData);
            }
        } catch (error) {
            console.error('Error al obtener los datos:', error);
        }
    };

        obtenerDatos();
    }, [userData]);

    // Función para obtener el número del mes a partir de su nombre
    const obtenerNumeroMes = (nombreMes) => {
        const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        return meses.indexOf(nombreMes.toLowerCase());
    };

    const toggleDuration = (duration) => {
        setHiddenDurations(hiddenDurations.includes(duration) ?
            hiddenDurations.filter((dur) => dur !== duration) :
            [...hiddenDurations, duration]
        );
    };

    const handleCheckboxChange = (periodIdx, programIdx, descIdx, checkboxName) => {
        const key = `${periodIdx}_${programIdx}_${descIdx}`;
        setSelectedCheckboxes(prevState => {
            const updated = { ...prevState, [key]: checkboxName };
    
            // Update percentage
            const programKey = `${periodIdx}_${programIdx}`;
            const relevantCheckboxes = Object.keys(updated).filter(k => k.startsWith(`${periodIdx}_${programIdx}_`));
            let totalValue = 0;
            let validPrograms = 0;
    
            relevantCheckboxes.forEach(k => {
                const value = checkboxValues[updated[k]];
                if (value !== null) {
                    totalValue += value;
                    validPrograms++;
                }
            });
    
            const percentage = validPrograms > 0 ? (totalValue / validPrograms) * 100 : 0;
    
            setPercentages(prevPercentages => ({
                ...prevPercentages,
                [programKey]: percentage
            }));
    
            return updated;
        });
    };
        

    const handleOpenModal = (fieldKey) => {
        setSelectedField(fieldKey);
        setModalOpen(true);
    };

    const handleCapture = (dataUrl) => {
        if (selectedField) {
            setCapturedPhotos(prev => ({
                ...prev,
                [selectedField]: dataUrl
            }));
        }
        setModalOpen(false);
    };

    const navigate = useNavigate();

    const handleUpdatePeriod = async (periodIdx) => {
        if (!areAllCheckboxesFilled(periodIdx)) {
            Swal.fire({
                icon: 'warning',
                title: 'Atención',
                text: 'Todos los checkboxes deben estar llenos antes de generar el reporte.',
            });
            return;
        }
    
        try {
            let totalPercentage = 0;
            const numPrograms = datos[periodIdx].Programa.length;
    
            for (let programIdx = 0; programIdx < numPrograms; programIdx++) {
                const programa = datos[periodIdx].Programa[programIdx];
                const observaciones = programa.Descripcion.map((desc, descIdx) => {
                    const fieldKey = `${periodIdx}_${programIdx}_${descIdx}`;
                    return {
                        ID: desc.ID,
                        Criterio: selectedCheckboxes[fieldKey] || '',
                        Observacion: document.querySelector(`textarea[name=Observaciones_${periodIdx}_${programIdx}_${descIdx}]`).value,
                        Hallazgo: capturedPhotos[fieldKey] || ''
                    };
                });
    
                const percentage = percentages[`${periodIdx}_${programIdx}`] || 0;
                totalPercentage += percentage;
    
                try {
                    await axios.put(`http://localhost:3002/datos/${datos[periodIdx]._id}`, {
                        programIdx,
                        observaciones,
                        percentage
                    });
                } catch (error) {
                    console.error('Error al actualizar los datos:', error);
                    alert('Error al actualizar los datos');
                    return;
                }
            }
    
            const totalPercentageAvg = (totalPercentage / numPrograms).toFixed(2);
            try {
                await axios.put(`http://localhost:3002/datos/${datos[periodIdx]._id}`, {
                    PorcentajeTotal: totalPercentageAvg,
                    Estado: 'Realizada'
                });
                Swal.fire({
                    icon: 'success',
                    title: 'Reporte generado',
                    text: 'El reporte se generó exitosamente',
                });
                navigate('/reporte');
            } catch (error) {
                console.error('Error al actualizar el porcentaje total:', error);
                alert('Error al actualizar el porcentaje total');
            }
        } catch (error) {
            console.error('Error en handleUpdatePeriod:', error);
        }
    };    
    
    const areAllCheckboxesFilled = (periodIdx) => {
        const numPrograms = datos[periodIdx].Programa.length;
    
        for (let programIdx = 0; programIdx < numPrograms; programIdx++) {
            const programa = datos[periodIdx].Programa[programIdx];
            for (let descIdx = 0; descIdx < programa.Descripcion.length; descIdx++) {
                const fieldKey = `${periodIdx}_${programIdx}_${descIdx}`;
                if (!selectedCheckboxes[fieldKey]) {
                    return false;
                }
            }
        }
        return true;
    };
    

    const getTdClass = (periodIdx, programIdx, descIdx, checkboxName) => {
        const key = `${periodIdx}_${programIdx}_${descIdx}`;
        if (selectedCheckboxes[key] === checkboxName) {
            switch (checkboxName) {
                case 'Conforme':
                    return 'selected-conforme';
                case 'm':
                    return 'selected-m';
                case 'M':
                    return 'selected-M';
                case 'C':
                    return 'selected-C';
                case 'NA':
                    return 'selected-NA';
                default:
                    return '';
            }
        }
        return '';
    };
    
    const getPercentageClass = (percentage) => {
        if (percentage >= 95) {
            return 'percentage-green';
        } else if (percentage >= 90) {
            return 'percentage-yellow';
        } else if (percentage >= 80) {
            return 'percentage-orange';
        } else if (percentage >= 0) {
            return 'percentage-red';
        } else {
            return '';
        }
    };

    return (
        <div>
            <div style={{ position: 'absolute', top: 0, left: 0 }}>
                <Navigation />
            </div>
            <div className="datos-container2">
                <div className="form-group-datos">
                    {datos.length === 0 ? (
                        <p>Sin auditorías pendientes</p>
                    ) : (
                        datos.map((dato, periodIdx) => (
                            <div key={periodIdx}>
                                <div className="duracion-bloque">
                                    <h2 onClick={() => toggleDuration(dato.Duracion)}>
                                        Período: {dato.Duracion}
                                    </h2>
                                </div>
                                <div className={`update-button-container ${hiddenDurations.includes(dato.Duracion) ? 'hidden' : ''}`}>
                                    <div className="header-container-datos">
                                        <img src={logo} alt="Logo Empresa" className="logo-empresa" />
                                        <button className="update-button" onClick={() => handleUpdatePeriod(periodIdx)}>
                                            Generar Reporte
                                        </button>
                                    </div>
                                    {hiddenDurations.includes(dato.Duracion) ? null :
                                        dato.Programa.map((programa, programIdx) => (
                                            <div key={programIdx}>
                                                <table>
                                                    <thead>
                                                        <tr>
                                                            <th colSpan="2">{programa.Nombre}</th>
                                                            <th colSpan="5" className="conformity-header">Conformidad</th>
                                                            <th colSpan="2" className={getPercentageClass(percentages[`${periodIdx}_${programIdx}`])}>
                                                            Porcentaje: {percentages[`${periodIdx}_${programIdx}`] ? percentages[`${periodIdx}_${programIdx}`].toFixed(2) : 0}%
                                                            </th>
                                                        </tr>
                                                        <tr>
                                                            <th>ID</th>
                                                            <th>Requisitos</th>
                                                            <th><div className='conforme-fuente'>Con</div></th>
                                                            <th>m</th>
                                                            <th>M</th>
                                                            <th>C</th>
                                                            <th>NA</th>
                                                            <th className='padingH'>Hallazgos</th>
                                                            <th>Evidencia</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {programa.Descripcion.map((desc, descIdx) => {
                                                            const fieldKey = `${periodIdx}_${programIdx}_${descIdx}`;
                                                            return (
                                                                <tr key={descIdx}>
                                                                    <td>{desc.ID}</td>
                                                                    <td className='alingR'>{desc.Requisito}</td>
                                                                    <td className={getTdClass(periodIdx, programIdx, descIdx, 'Conforme')}>
                                                                        <input
                                                                            type="checkbox"
                                                                            name={`Conforme_${periodIdx}_${programIdx}_${descIdx}`}
                                                                            checked={selectedCheckboxes[`${periodIdx}_${programIdx}_${descIdx}`] === 'Conforme'}
                                                                            onChange={() => handleCheckboxChange(periodIdx, programIdx, descIdx, 'Conforme')}
                                                                        />
                                                                    </td>
                                                                    <td className={getTdClass(periodIdx, programIdx, descIdx, 'm')}>
                                                                        <input
                                                                            type="checkbox"
                                                                            name={`m_${periodIdx}_${programIdx}_${descIdx}`}
                                                                            checked={selectedCheckboxes[`${periodIdx}_${programIdx}_${descIdx}`] === 'm'}
                                                                            onChange={() => handleCheckboxChange(periodIdx, programIdx, descIdx, 'm')}
                                                                        />
                                                                    </td>
                                                                    <td className={getTdClass(periodIdx, programIdx, descIdx, 'M')}>
                                                                        <input
                                                                            type="checkbox"
                                                                            name={`M_${periodIdx}_${programIdx}_${descIdx}`}
                                                                            checked={selectedCheckboxes[`${periodIdx}_${programIdx}_${descIdx}`] === 'M'}
                                                                            onChange={() => handleCheckboxChange(periodIdx, programIdx, descIdx, 'M')}
                                                                        />
                                                                    </td>
                                                                    <td className={getTdClass(periodIdx, programIdx, descIdx, 'C')}>
                                                                        <input
                                                                            type="checkbox"
                                                                            name={`C_${periodIdx}_${programIdx}_${descIdx}`}
                                                                            checked={selectedCheckboxes[`${periodIdx}_${programIdx}_${descIdx}`] === 'C'}
                                                                            onChange={() => handleCheckboxChange(periodIdx, programIdx, descIdx, 'C')}
                                                                        />
                                                                    </td>
                                                                    <td className={getTdClass(periodIdx, programIdx, descIdx, 'NA')}>
                                                                        <input
                                                                            type="checkbox"
                                                                            name={`NA_${periodIdx}_${programIdx}_${descIdx}`}
                                                                            checked={selectedCheckboxes[`${periodIdx}_${programIdx}_${descIdx}`] === 'NA'}
                                                                            onChange={() => handleCheckboxChange(periodIdx, programIdx, descIdx, 'NA')}
                                                                        />
                                                                    </td>
                                                                    <td className='espacio-test'>
                                                                        <textarea
                                                                            name={`Observaciones_${periodIdx}_${programIdx}_${descIdx}`}
                                                                            defaultValue={desc.Observacion}
                                                                            className="textarea-custom"
                                                                        ></textarea>
                                                                    </td>
                                                                    <td>
                                                                        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
                                                                        <Button color="green" onClick={() => handleOpenModal(fieldKey)}>
                                                                            <span className="material-symbols-outlined">
                                                                                add_a_photo
                                                                            </span>
                                                                        </Button>
                                                                        {capturedPhotos[fieldKey] && (
                                                                            <img src={capturedPhotos[fieldKey]} alt="Captura" style={{ width: '100px', height: 'auto' }} />
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
            <Fotos open={modalOpen} onClose={() => setModalOpen(false)} onCapture={handleCapture} />
        </div>
    );       
};

export default Pendientes;