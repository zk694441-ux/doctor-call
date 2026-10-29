import React, { useState } from 'react';
import { Card, Table, Tag, Button, Typography, Modal, Input, message, Avatar, Space, Row, Col, Statistic, Tooltip } from 'antd';
import { FaFileInvoice, FaUndo, FaSearch, FaDollarSign, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import moment from 'moment';
import { useGetPaymentHistoryQuery, useRequestRefundMutation } from '../../redux/api/paymentApi';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const statusColorMap = {
  paid: 'success',
  pending: 'processing',
  failed: 'error',
  expired: 'default',
};

const refundColorMap = {
  completed: 'success',
  pending: 'processing',
  manual_pending: 'warning',
  failed: 'error',
};

const PaymentHistory = () => {
  const { data: payments = [], isLoading, refetch } = useGetPaymentHistoryQuery();
  const [requestRefund, { isLoading: isRefunding }] = useRequestRefundMutation();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [refundReason, setRefundReason] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);

  const openRefundModal = (payment) => {
    setSelectedAppointment(payment);
    setRefundReason('');
    setIsModalVisible(true);
  };

  const handleConfirmRefund = async () => {
    if (!selectedAppointment?.appointmentId) return;

    try {
      await requestRefund({
        appointmentId: selectedAppointment.appointmentId,
        reason: refundReason || 'Patient requested appointment cancellation',
      }).unwrap();

      message.success('Refund request initiated! Your cancellation has been recorded.');
      setIsModalVisible(false);
      refetch();
    } catch (err) {
      message.error(err?.data?.message || 'Failed to process refund request.');
    }
  };

  const filteredPayments = payments.filter((item) => {
    const docName = `${item?.appointment?.doctor?.firstName || ''} ${item?.appointment?.doctor?.lastName || ''}`.toLowerCase();
    const trackingId = (item?.appointment?.trackingId || '').toLowerCase();
    const search = searchTerm.toLowerCase();
    return docName.includes(search) || trackingId.includes(search);
  });

  const totalSpent = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + (Number(p.totalAmount) || 0), 0);
  const paidCount = payments.filter(p => p.status === 'paid').length;
  const refundedCount = payments.filter(p => p.refunds && p.refunds.length > 0).length;

  const columns = [
    {
      title: 'Appointment',
      key: 'appointment',
      render: (_, record) => {
        const doc = record.appointment?.doctor;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Avatar src={doc?.img} size={42} style={{ background: '#0d6efd' }}>
              {(doc?.firstName?.[0] || 'D').toUpperCase()}
            </Avatar>
            <div>
              <div style={{ fontWeight: 600 }}>
                {doc ? `Dr. ${doc.firstName} ${doc.lastName}` : 'Consultation'}
              </div>
              <div style={{ fontSize: '12px', color: '#6c757d' }}>
                ID: #{record.appointment?.trackingId || record.appointmentId?.slice(0, 8)}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Schedule',
      key: 'schedule',
      render: (_, record) => (
        <div>
          <div>{record.appointment?.scheduleDate || '—'}</div>
          <div style={{ fontSize: '12px', color: '#6c757d' }}>{record.appointment?.scheduleTime || ''}</div>
        </div>
      ),
    },
    {
      title: 'Amount',
      key: 'totalAmount',
      render: (_, record) => (
        <span style={{ fontWeight: 700, color: '#198754' }}>
          ${Number(record.totalAmount || 0).toFixed(2)}
        </span>
      ),
    },
    {
      title: 'Payment Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={statusColorMap[status] || 'default'} style={{ textTransform: 'uppercase', fontWeight: 600 }}>
          {status || 'PENDING'}
        </Tag>
      ),
    },
    {
      title: 'Refund Status',
      key: 'refund',
      render: (_, record) => {
        const refund = record.refunds?.[0];
        if (refund) {
          return (
            <div>
              <Tag color={refundColorMap[refund.status] || 'default'}>
                {refund.status.replace('_', ' ').toUpperCase()} (${Number(refund.amount).toFixed(2)})
              </Tag>
              {refund.reason && (
                <div style={{ fontSize: '11px', color: '#6c757d', marginTop: 2 }}>{refund.reason}</div>
              )}
            </div>
          );
        }
        if (
          record.status === 'paid' &&
          record.appointment?.status !== 'cancelled' &&
          record.appointment?.status !== 'completed'
        ) {
          return (
            <Button
              type="link"
              danger
              icon={<FaUndo />}
              onClick={() => openRefundModal(record)}
              style={{ padding: 0 }}
            >
              Request Refund
            </Button>
          );
        }
        return <span style={{ color: '#adb5bd' }}>—</span>;
      },
    },
    {
      title: 'Receipt',
      key: 'receipt',
      render: (_, record) => (
        <Link to={`/booking/invoice/${record.appointmentId}`}>
          <Button size="small" icon={<FaFileInvoice />}>
            View Receipt
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div style={{ padding: '4px' }}>
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: '#f8f9fa', borderRadius: '8px' }}>
            <Statistic
              title="Total Paid Consultations"
              value={`$${totalSpent.toFixed(2)}`}
              prefix={<FaDollarSign style={{ color: '#198754' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: '#f8f9fa', borderRadius: '8px' }}>
            <Statistic
              title="Successful Transactions"
              value={paidCount}
              prefix={<FaCheckCircle style={{ color: '#0d6efd' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: '#f8f9fa', borderRadius: '8px' }}>
            <Statistic
              title="Refunds Handled"
              value={refundedCount}
              prefix={<FaUndo style={{ color: '#fd7e14' }} />}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={<Title level={4} style={{ margin: 0 }}>Consultation Payment History &amp; Refunds</Title>}
        extra={
          <Input
            placeholder="Search by doctor or tracking ID..."
            prefix={<FaSearch style={{ color: '#adb5bd' }} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
        }
      >
        <Table
          columns={columns}
          dataSource={filteredPayments}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 8 }}
          scroll={{ x: 750 }}
        />
      </Card>

      {/* Cancellation & Refund Policy Confirmation Modal */}
      <Modal
        open={isModalVisible}
        title="Cancel Appointment & Request Refund"
        onCancel={() => setIsModalVisible(false)}
        onOk={handleConfirmRefund}
        confirmLoading={isRefunding}
        okText="Confirm Cancellation & Refund"
        okButtonProps={{ danger: true }}
      >
        <Paragraph>
          You are requesting cancellation for your consultation with{' '}
          <strong>
            Dr. {selectedAppointment?.appointment?.doctor?.firstName}{' '}
            {selectedAppointment?.appointment?.doctor?.lastName}
          </strong>{' '}
          on {selectedAppointment?.appointment?.scheduleDate}.
        </Paragraph>

        <div style={{ background: '#fff3cd', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>
          <strong>Refund Policy:</strong>
          <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
            <li>Full refund (100%) if cancelled at least 24 hours prior.</li>
            <li>Partial refund (70%) if cancelled between 4 and 24 hours prior.</li>
            <li>No refund within 4 hours of appointment schedule.</li>
          </ul>
        </div>

        <Text strong>Reason for Cancellation (optional):</Text>
        <TextArea
          rows={3}
          placeholder="Please let us know why you need to cancel..."
          value={refundReason}
          onChange={(e) => setRefundReason(e.target.value)}
          style={{ marginTop: '8px' }}
        />
      </Modal>
    </div>
  );
};

export default PaymentHistory;
