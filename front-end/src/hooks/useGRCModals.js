import { useState, useCallback } from 'react';
import CreditFreezeModal from '../components/CreditFreezeModal';
import TaxWarningModal from '../components/TaxWarningModal';

/**
 * Hook quản lý state và logic cho GRC Modals
 * - Credit Freeze Modal: Hiển thị khi đơn hàng bị freeze
 * - Tax Warning Modal: Hiển thị khi có cảnh báo thuế
 */
export default function useGRCModals() {
  const [creditFreeze, setCreditFreeze] = useState({
    isOpen: false,
    orderData: null,
  });

  const [taxWarning, setTaxWarning] = useState({
    isOpen: false,
    taxData: null,
  });

  // Credit Freeze Modal handlers
  const openCreditFreeze = useCallback((orderData) => {
    setCreditFreeze({
      isOpen: true,
      orderData,
    });
  }, []);

  const closeCreditFreeze = useCallback(() => {
    setCreditFreeze({
      isOpen: false,
      orderData: null,
    });
  }, []);

  const handleCreditFreezeRetry = useCallback(() => {
    // Trigger retry logic - sẽ được implement sau
    console.log('Retry after credit adjustment');
    closeCreditFreeze();
  }, [closeCreditFreeze]);

  const handleContactSupport = useCallback(() => {
    // Mở form liên hệ kế toán hoặc email
    window.location.href = 'mailto:ketoan@company.com?subject=Yêu cầu điều chỉnh hạn mức tín dụng';
  }, []);

  // Tax Warning Modal handlers
  const openTaxWarning = useCallback((taxData) => {
    setTaxWarning({
      isOpen: true,
      taxData,
    });
  }, []);

  const closeTaxWarning = useCallback(() => {
    setTaxWarning({
      isOpen: false,
      taxData: null,
    });
  }, []);

  const handleTaxConfirm = useCallback(() => {
    // User confirmed - proceed with the transaction
    console.log('Tax warning confirmed');
    closeTaxWarning();
  }, [closeTaxWarning]);

  const handleTaxDismiss = useCallback(() => {
    // User dismissed - still proceed but log the warning
    console.log('Tax warning dismissed');
    closeTaxWarning();
  }, [closeTaxWarning]);

  // Check if response has credit freeze
  const checkCreditFreeze = useCallback((response) => {
    if (response?.status === 'FROZEN' || response?.credit_freeze) {
      openCreditFreeze({
        orderCode: response.order_code,
        total: response.total,
        customerName: response.customer_name,
        creditInfo: response.credit_info,
      });
      return true;
    }
    return false;
  }, [openCreditFreeze]);

  // Check if response has tax warning
  const checkTaxWarning = useCallback((response) => {
    if (response?.tax_warning || response?.tax_details) {
      openTaxWarning({
        taxDetails: response.tax_details,
        deductibleTax: response.deductible_tax,
        documentCode: response.document_code,
        documentDate: response.document_date,
      });
      return true;
    }
    return false;
  }, [openTaxWarning]);

  return {
    // Credit Freeze
    creditFreeze,
    openCreditFreeze,
    closeCreditFreeze,
    handleCreditFreezeRetry,
    handleContactSupport,

    // Tax Warning
    taxWarning,
    openTaxWarning,
    closeTaxWarning,
    handleTaxConfirm,
    handleTaxDismiss,

    // Utility
    checkCreditFreeze,
    checkTaxWarning,
  };
}

/**
 * Higher-Order Component để wrap form với GRC modal handling
 */
export function withGRCModals(WrappedComponent) {
  return function GRCModalWrapper(props) {
    const grc = useGRCModals();

    return (
      <>
        <WrappedComponent {...props} grc={grc} />
        
        {/* Credit Freeze Modal */}
        <CreditFreezeModal
          isOpen={grc.creditFreeze.isOpen}
          onClose={grc.closeCreditFreeze}
          orderData={grc.creditFreeze.orderData}
          onRetry={grc.handleCreditFreezeRetry}
          onContactSupport={grc.handleContactSupport}
        />

        {/* Tax Warning Modal */}
        <TaxWarningModal
          isOpen={grc.taxWarning.isOpen}
          onClose={grc.closeTaxWarning}
          taxData={grc.taxWarning.taxData}
          onConfirm={grc.handleTaxConfirm}
          onDismiss={grc.handleTaxDismiss}
        />
      </>
    );
  };
}