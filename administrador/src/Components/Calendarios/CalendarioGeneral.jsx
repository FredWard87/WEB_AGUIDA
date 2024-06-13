import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './css/calendariosito.css';
import axios from 'axios';
import { format, parseISO, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

const AuditCalendar = () => {
  const [audits, setAudits] = useState([]);
  const [selectedAudits, setSelectedAudits] = useState([]);

  useEffect(() => {
    const fetchAudits = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/datos`);
        setAudits(response.data);
      } catch (error) {
        console.error('Error fetching audit data:', error);
      }
    };

    fetchAudits();
  }, []);

  const handleDateClick = (date) => {
    const filteredAudits = audits.filter(audit => 
      isSameDayWithoutTZAdjustment(audit.FechaInicio, date) || 
      isSameDayWithoutTZAdjustment(audit.FechaFin, date)
    );
    setSelectedAudits(filteredAudits);
  };

  const isSameDayWithoutTZAdjustment = (dateString, date) => {
    const auditDate = startOfDay(parseISO(dateString));
    const compareDate = startOfDay(date);
    return auditDate.getTime() === compareDate.getTime();
  };

  const tileClassName = ({ date, view }) => {
    if (view === 'month') {
      const startDate = audits.some(audit => isSameDayWithoutTZAdjustment(audit.FechaInicio, date));
      const endDate = audits.some(audit => isSameDayWithoutTZAdjustment(audit.FechaFin, date));
      
      if (startDate) return 'start-date';
      if (endDate) return 'end-date';
    }
    return null;
  };

  const formatDate = (dateString) => {
    return format(parseISO(dateString), "d 'de' MMMM 'de' yyyy", { locale: es });
  };

  return (
    <div className="audit-calendar-container">
      <Calendar
        onClickDay={handleDateClick}
        tileClassName={tileClassName}
      />
      {selectedAudits.length > 0 && (
        <div className="accordion">
          {selectedAudits.map((audit, index) => (
            <div className="accordion-item" key={index}>
              <input type="checkbox" id={`audit-details-toggle-${index}`} />
              <label className="accordion-header" htmlFor={`audit-details-toggle-${index}`}>
                Detalle de auditoría
              </label>
              <div className="accordion-content">
                <p><strong>Nombre del programa:</strong> {audit.Programa.map(prog => prog.Nombre).join(', ')}</p>
                <p><strong>Departmento:</strong> {audit.Departamento}</p>
                <p><strong>Area:</strong> {audit.AreasAudi}</p>
                <p><strong>Auditor líder:</strong> {audit.AuditorLider}</p>
                <p><strong>Fecha de inicio de la auditoría:</strong> {formatDate(audit.FechaInicio)}</p>
                <p><strong>Fecha de finalización de la auditoría:</strong> {formatDate(audit.FechaFin)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AuditCalendar;
