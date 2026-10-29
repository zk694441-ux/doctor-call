import React from 'react';
import moment from 'moment';
import { DatePicker, Card, Alert } from 'antd';
import { FaCalendarAlt, FaClock } from 'react-icons/fa';

const SelectDateAndTime = ({ content, handleDateChange, disabledDateTime, selectedDate, dContent, selectTime }) => {
    return (
        <div style={{ marginTop: '2rem' }}>
            <div className="mb-4">
                <h5 className='text-title' style={{ fontSize: '1.1rem', fontWeight: 600 }}>Doctor Details</h5>
                {content}
            </div>

            <div className="row g-4">
                <div className="col-md-5 col-sm-12">
                    <Card title={<><FaCalendarAlt style={{ marginRight: 8, color: '#0d6efd' }} /> 1. Select Consultation Date</>} bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderRadius: 8 }}>
                        <p style={{ fontSize: '13px', color: '#6c757d', marginBottom: 12 }}>
                            Choose an available date for your consultation:
                        </p>
                        <DatePicker
                            format="YYYY-MM-DD"
                            disabledDate={disabledDateTime}
                            onChange={handleDateChange}
                            size="large"
                            style={{ width: '100%' }}
                            placeholder="Click to choose date"
                        />
                        {selectedDate && (
                            <Alert
                                message={`Selected Date: ${moment(selectedDate).format('dddd, MMMM Do YYYY')}`}
                                type="info"
                                showIcon
                                style={{ marginTop: 16 }}
                            />
                        )}
                    </Card>
                </div>

                <div className="col-md-7 col-sm-12">
                    <Card title={<><FaClock style={{ marginRight: 8, color: '#0d6efd' }} /> 2. Select Time Slot</>} bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderRadius: 8, minHeight: 260 }}>
                        {!selectedDate ? (
                            <div className="text-center py-5" style={{ color: '#6c757d' }}>
                                <FaCalendarAlt style={{ fontSize: '2.5rem', opacity: 0.3, marginBottom: 12 }} />
                                <p style={{ fontSize: '15px' }}>Please choose a date on the left to view available time slots.</p>
                            </div>
                        ) : (
                            <div>
                                <p style={{ fontSize: '13px', color: '#6c757d', marginBottom: 16 }}>
                                    Click any time slot below to confirm your schedule:
                                </p>
                                {dContent}
                                {selectTime && (
                                    <Alert
                                        message={`Selected Time Slot: ${selectTime}`}
                                        type="success"
                                        showIcon
                                        style={{ marginTop: 20 }}
                                    />
                                )}
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default SelectDateAndTime;
