import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CreditCard, Fingerprint, Loader2, MoreVertical, Plus, Search, UserRound, X, Eye, Edit, Trash2 } from 'lucide-react';
import { registerMember, getMemberById, getMembers, softDeleteMember, updateMember, updateMembershipPlan } from '@/services/members-api';
import { fingerPrintSave } from '@/services/fingerprint-api';
import { processPayment } from '@/services/payment-api';
import { getMembershipPlans } from '@/services/membership-plans-api';
import Alert from '@/components/ui/alert';

type MemberStatus = 'approved' | 'pending' | 'blocked';

type ApiMember = {
  id: string;
  membershipNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string | null;
  dateOfBirth: string;
  gender: string;
  membershipStatus: string;
  membershipPlan: string;
  identityUserId: string | null;
};

type TableMember = {
  id: string;
  name: string;
  pid: string;
  age: string;
  gender: string;
  phone: string;
  status: MemberStatus;
  paymentStatus: number;
  isSavedFingerprints: boolean;
};

type MemberDetails = {
  id: string;
  membershipNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string | null;
  dateOfBirth: string;
  gender: number;
  membershipStatus: string;
  membershipPlanId: string;
  membershipPlanTitle: string;
  membershipPlanPrice: number;
  membershipStartDate: string;
  membershipEndDate: string;
  paymentStatus: number;
  membershipPlanDurationInDays: number;
  identityUserId: string | null;
  isSavedFingerprints: boolean;
};

type MemberForm = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email: string;
  membershipPlan: string;
};

type MemberRegistrationPayload = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  dateOfBirth: string;
  memberType: number;
  MembershipPlanId: string;
  gender: number;
  deviceFingerprintId1: string | null;
  deviceFingerprintId2: string | null;
  password: string;
};

type MembershipPlan = {
  id: string;
  title: string;
  price: number;
};

type MemberFieldErrors = Partial<Record<keyof MemberForm, string>>;

type MemberEditForm = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email: string;
};

const sriLankanMobileRegex = /^7\d{8}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateMemberForm = (form: MemberForm): MemberFieldErrors => {
  const errors: MemberFieldErrors = {};

  if (!form.firstName.trim()) {
    errors.firstName = 'First name is required.';
  }

  if (!form.lastName.trim()) {
    errors.lastName = 'Last name is required.';
  }

  if (!form.dateOfBirth) {
    errors.dateOfBirth = 'Date of birth is required.';
  } else {
    // expect yyyy-mm-dd
    const m = form.dateOfBirth.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) {
      errors.dateOfBirth = 'Enter a valid date (YYYY-MM-DD).';
    } else {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      const ts = Date.UTC(y, mo - 1, d);
      if (!isFinite(ts)) errors.dateOfBirth = 'Enter a valid date.';
    }
  }

  const phone = form.phone.trim().replace(/[\s-]/g, '');
  if (!sriLankanMobileRegex.test(phone)) {
    errors.phone = 'Enter a valid Sri Lankan mobile number without +94 (e.g. 712345678).';
  }

  if (!emailRegex.test(form.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }

  if (!form.membershipPlan) {
    errors.membershipPlan = 'Select a membership plan.';
  }

  return errors;
};

const validateMemberEditForm = (form: MemberEditForm): MemberFieldErrors => {
  const errors: MemberFieldErrors = {};

  if (!form.firstName.trim()) {
    errors.firstName = 'First name is required.';
  }

  if (!form.lastName.trim()) {
    errors.lastName = 'Last name is required.';
  }

  if (!form.dateOfBirth) {
    errors.dateOfBirth = 'Date of birth is required.';
  } else {
    const m = form.dateOfBirth.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) {
      errors.dateOfBirth = 'Enter a valid date (YYYY-MM-DD).';
    } else {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      const ts = Date.UTC(y, mo - 1, d);
      if (!isFinite(ts)) errors.dateOfBirth = 'Enter a valid date.';
    }
  }

  const phone = form.phone.trim().replace(/[\s-]/g, '');
  if (!sriLankanMobileRegex.test(phone)) {
    errors.phone = 'Enter a valid Sri Lankan mobile number without +94 (e.g. 712345678).';
  }

  if (!emailRegex.test(form.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }

  return errors;
};

const initialMemberForm: MemberForm = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: 'Male',
  phone: '',
  email: '',
  membershipPlan: '',
};

const initialMemberEditForm: MemberEditForm = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: 'Male',
  phone: '',
  email: '',
};

export default function Members() {
  const [members, setMembers] = useState<TableMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [membersError, setMembersError] = useState('');
  const [membershipPlans, setMembershipPlans] = useState<MembershipPlan[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [plansError, setPlansError] = useState('');

  const [activeTab, setActiveTab] = useState<MemberStatus>('approved');
  const [isNewMemberOpen, setIsNewMemberOpen] = useState(false);
  const [memberStep, setMemberStep] = useState(1);
  const [registeredMemberId, setRegisteredMemberId] = useState<string | null>(null);
  const [form, setForm] = useState<MemberForm>(initialMemberForm);
  const [fieldErrors, setFieldErrors] = useState<MemberFieldErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [pageAlert, setPageAlert] = useState<{ visible: boolean; variant?: 'success' | 'error' | 'warning' | 'info'; title?: string; description?: string }>({ visible: false });
  const [isViewMemberOpen, setIsViewMemberOpen] = useState(false);
  const [isLoadingMemberDetails, setIsLoadingMemberDetails] = useState(false);
  const [memberDetailsError, setMemberDetailsError] = useState('');
  const [selectedMemberDetails, setSelectedMemberDetails] = useState<MemberDetails | null>(null);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [paymentRemark, setPaymentRemark] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [isFingerprintModalOpen, setIsFingerprintModalOpen] = useState(false);
  const [fingerprintId1, setFingerprintId1] = useState('DUMMY_FINGERPRINT_1');
  const [fingerprintId2, setFingerprintId2] = useState('DUMMY_FINGERPRINT_2');
  const [fingerprintSaveLoading, setFingerprintSaveLoading] = useState(false);
  const [isSubmittingFingerprint, setIsSubmittingFingerprint] = useState(false);
  const [isEditMemberOpen, setIsEditMemberOpen] = useState(false);
  const [editMemberId, setEditMemberId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<MemberEditForm>(initialMemberEditForm);
  const [editFieldErrors, setEditFieldErrors] = useState<MemberFieldErrors>({});
  const [isSavingMemberEdit, setIsSavingMemberEdit] = useState(false);
  const [isLoadingEditMember, setIsLoadingEditMember] = useState(false);
  const [editMemberError, setEditMemberError] = useState('');
  const [isMembershipModalOpen, setIsMembershipModalOpen] = useState(false);
  const [membershipMemberId, setMembershipMemberId] = useState<string | null>(null);
  const [membershipMemberDetails, setMembershipMemberDetails] = useState<MemberDetails | null>(null);
  const [membershipPlanId, setMembershipPlanId] = useState('');
  const [membershipPaymentMethod, setMembershipPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [isSavingMembershipChange, setIsSavingMembershipChange] = useState(false);
  const [membershipChangeError, setMembershipChangeError] = useState('');
  const [deleteMemberTarget, setDeleteMemberTarget] = useState<TableMember | null>(null);
  const [isDeletingMember, setIsDeletingMember] = useState(false);
  const [deleteMemberError, setDeleteMemberError] = useState('');

  // pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [openAction, setOpenAction] = useState<{ id: string; top: number; left: number } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Helper functions
  const calculateAge = (dateOfBirth: string): string => {
    try {
      const [day, month, year] = dateOfBirth.split('/').map(Number);
      const birthDate = new Date(year, month - 1, day);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
      return age > 0 ? `${age} yrs` : '-- yrs';
    } catch {
      return '-- yrs';
    }
  };

  const mapMembershipStatusToTabStatus = (status: string): MemberStatus => {
    if (status === 'Active') return 'approved';
    if (status === 'Inactive') return 'pending';
    return 'blocked';
  };

  const paymentStatusLabel = (status: number): string => {
    if (status === 1) return 'Pending';
    if (status === 2) return 'Paid';
    if (status === 3) return 'Overdue';
    if (status === 4) return 'Completed';
    if (status === 5) return 'Cancelled';
    return 'Unknown';
  };

  const formatDisplayDate = (value: string) => {
    if (!value) return 'N/A';

    // Already in dd/MM/yyyy format
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
      return value;
    }

    // Convert yyyy-MM-dd directly without Date parsing timezone side effects
    const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      return `${day}/${month}/${year}`;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatDateInputValue = (value: string) => {
    if (!value) return '';

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
      const [day, month, year] = value.split('/');
      return `${year}-${month}-${day}`;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
  };

  // Fetch members on component mount
  useEffect(() => {
    fetchMembers();
  }, []);

  useEffect(() => {
    fetchMembershipPlans();
  }, []);

  const fetchMembers = async () => {
    setIsLoadingMembers(true);
    try {
      const apiMembers: ApiMember[] = await getMembers();

      // Filter members to only show those with membershipNumber starting with "GYM-MEM"
      const filteredApiMembers = apiMembers.filter((member) =>
        member.membershipNumber.startsWith('GYM-MEM')
      );

      // Map API response to table format
      const mappedMembers: TableMember[] = filteredApiMembers.map((member) => ({
        id: member.id,
        name: `${member.firstName} ${member.lastName}`,
        pid: member.membershipNumber,
        age: calculateAge(member.dateOfBirth),
        gender: Number(member.gender) === 1 ? "Male" : "Female",
        phone: member.phoneNumber ? `+94${member.phoneNumber}` : 'N/A',
        status: mapMembershipStatusToTabStatus(member.membershipStatus),
        paymentStatus: Number((member as any).paymentStatus ?? 0),
        isSavedFingerprints: Boolean((member as any).isSavedFingerprints ?? (member as any).fingerprintSaved ?? false),
      }));

      setMembers(mappedMembers);
      setMembersError('');
    } catch (error) {
      setMembersError('Failed to load members. Please try again later.');
      setMembers([]);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const fetchMembershipPlans = async () => {
    setIsLoadingPlans(true);
    try {
      const response = await getMembershipPlans();
      const plans = response?.additionalData?.response ?? response?.response ?? response ?? [];

      const mappedPlans: MembershipPlan[] = Array.isArray(plans)
        ? plans.map((plan: any) => ({
          id: String(plan.id),
          title: String(plan.title ?? 'Unnamed Plan'),
          price: Number(plan.price ?? 0),
        }))
        : [];

      setMembershipPlans(mappedPlans);
      setPlansError('');

      setForm((current) => {
        if (current.membershipPlan || mappedPlans.length === 0) {
          return current;
        }

        return { ...current, membershipPlan: mappedPlans[0].id };
      });
    } catch (error) {
      setPlansError('Failed to load membership plans. Please try again later.');
      setMembershipPlans([]);
    } finally {
      setIsLoadingPlans(false);
    }
  };

  useEffect(() => {
    const handleDoc = () => setOpenAction(null);
    if (openAction) document.addEventListener('mousedown', handleDoc);
    return () => document.removeEventListener('mousedown', handleDoc);
  }, [openAction]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  const filteredMembers = members.filter((member) => {
    if (member.status !== activeTab) return false;

    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;

    const statusLabel =
      member.status === 'approved'
        ? 'active'
        : member.status === 'pending'
          ? 'inactive'
          : 'blocked';

    return [member.name, member.pid, member.phone, statusLabel]
      .join(' ')
      .toLowerCase()
      .includes(query);
  });
  const total = filteredMembers.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const pageItems = filteredMembers.slice(start, start + pageSize);
  const selectedMembershipPlan = membershipPlans.find((plan) => plan.id === form.membershipPlan);
  const selectedMembershipChangePlan = membershipPlans.find((plan) => plan.id === membershipPlanId);
  const canDeleteMember = (member: TableMember) => member.status === 'pending' && member.paymentStatus === 1 && !member.isSavedFingerprints;
  const tabs = [
    { key: 'approved', label: 'Approved Members' },
    { key: 'pending', label: 'Pending Members' },
    { key: 'blocked', label: 'Blocked Members' },
  ] as const;

  const openNewMemberModal = () => {
    setForm(initialMemberForm);
    setFieldErrors({});
    setSubmitError('');
    setMemberStep(1);
    setIsNewMemberOpen(true);
  };

  const closeNewMemberModal = () => {
    setIsNewMemberOpen(false);
    setMemberStep(1);
    setFieldErrors({});
    setSubmitError('');
    setIsRegistering(false);
    setIsSubmittingFingerprint(false);
    setForm(initialMemberForm);
    setSearchTerm('');
  };

  const updateField = (field: keyof MemberForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const buildRegistrationPayload = (): MemberRegistrationPayload => ({
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim(),
    phone: form.phone.trim() ? form.phone.trim() : null,
    dateOfBirth: (function toIso(d: string) {
      if (!d) return '';
      const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return '';
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const day = Number(m[3]);
      return new Date(Date.UTC(y, mo - 1, day)).toISOString();
    })(form.dateOfBirth),
    password: form.firstName.trim(),
    memberType: 1,
    MembershipPlanId: form.membershipPlan,
    gender: form.gender === 'Female' ? 2 : 1,
    deviceFingerprintId1: null,
    deviceFingerprintId2: null,
  });

  const goToNextStep = async () => {
    const validationErrors = validateMemberForm(form);
    setFieldErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setSubmitError('');
    setIsRegistering(true);

    try {
      const res = await registerMember(buildRegistrationPayload());
      const created = res?.additionalData?.response ?? res?.response ?? res ?? null;
      const newMemberId = created?.id ?? created?.memberId ?? null;

      setPageAlert({
        visible: true,
        variant: 'success',
        title: 'Details Saved',
        description: 'The member details have been successfully saved.'
      });

      setRegisteredMemberId(newMemberId ?? null);

      // If we have a new member id, fetch details to use in payment step
      if (newMemberId) {
        try {
          const detailResp = await getMemberById(newMemberId);
          const member = detailResp?.additionalData?.response ?? detailResp?.response ?? null;
          if (member) setSelectedMemberDetails(member as MemberDetails);
        } catch {
          // ignore
        }
      }

      setMemberStep(2);
      setSearchTerm('');
    } catch (error:any) {      
      setPageAlert({
        visible: true,
        variant: 'error',
        title: 'Registration Failed',
        description: error.response.data.message || 'An error occurred while registering the member. Please try again.'
      });
    } finally {
      setIsRegistering(false);
      fetchMembers();
    }
  };

  const goBackStep = () => setMemberStep(1);

  const handleFinalSubmit = async () => {
    if (!registeredMemberId) {
      setPageAlert({
        visible: true,
        variant: 'warning',
        title: 'No Member Found',
        description: 'Please register the member details first.'
      });
      return;
    }

    setIsSubmittingFingerprint(true);
    try {
      await fingerPrintSave(registeredMemberId, {
        deviceFingerprintId1: fingerprintId1.trim() || 'DUMMY_FINGERPRINT_1',
        deviceFingerprintId2: fingerprintId2.trim() || 'DUMMY_FINGERPRINT_2',
      });

      setPageAlert({
        visible: true,
        variant: 'success',
        title: 'Fingerprint Saved',
        description: 'Fingerprint details have been saved successfully.'
      });

      closeNewMemberModal();

      window.setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Failed to save fingerprint details.';
      setPageAlert({
        visible: true,
        variant: 'error',
        title: 'Fingerprint Save Failed',
        description: message,
      });
    } finally {
      setIsSubmittingFingerprint(false);
    }
  };

  const openViewMemberModal = async (memberId: string) => {
    setOpenAction(null);
    setIsViewMemberOpen(true);
    setIsLoadingMemberDetails(true);
    setMemberDetailsError('');
    setSelectedMemberDetails(null);

    try {
      const response = await getMemberById(memberId);
      const member = response?.additionalData?.response ?? response?.response ?? null;

      if (!member) {
        setMemberDetailsError('Unable to load member details.');
        return;
      }

      setSelectedMemberDetails(member as MemberDetails);
    } catch (error) {
      setMemberDetailsError('Failed to load member details. Please try again.');
    } finally {
      setIsLoadingMemberDetails(false);
    }
  };

  const closeViewMemberModal = () => {
    setIsViewMemberOpen(false);
    setIsLoadingMemberDetails(false);
    setMemberDetailsError('');
    setSelectedMemberDetails(null);
    setIsPayModalOpen(false);
    setIsFingerprintModalOpen(false);
    setPaymentMethod('cash');
    setPaymentRemark('');
    setFingerprintId1('DUMMY_FINGERPRINT_1');
    setFingerprintId2('DUMMY_FINGERPRINT_2');
  };

  const openPaymentModal = () => {
    if (!selectedMemberDetails) return;

    setPaymentMethod('cash');
    setPaymentRemark('');
    setIsPayModalOpen(true);
  };

  const closePaymentModal = () => {
    setIsPayModalOpen(false);
    setPaymentMethod('cash');
    setPaymentRemark('');
  };

  const openFingerprintModal = () => {
    if (!selectedMemberDetails) return;

    setFingerprintId1('DUMMY_FINGERPRINT_1');
    setFingerprintId2('DUMMY_FINGERPRINT_2');
    setIsFingerprintModalOpen(true);
  };

  const openUpdateFingerprintsModal = async (memberId: string) => {
    setOpenAction(null);
    setIsLoadingMemberDetails(true);
    setMemberDetailsError('');
    setIsViewMemberOpen(true);
    setIsFingerprintModalOpen(false);

    try {
      const response = await getMemberById(memberId);
      const member = response?.additionalData?.response ?? response?.response ?? null;

      if (!member) {
        setMemberDetailsError('Unable to load member details.');
        return;
      }

      setSelectedMemberDetails(member as MemberDetails);
      setFingerprintId1('DUMMY_FINGERPRINT_1');
      setFingerprintId2('DUMMY_FINGERPRINT_2');
      setIsFingerprintModalOpen(true);
    } catch {
      setMemberDetailsError('Failed to load member details. Please try again.');
    } finally {
      setIsLoadingMemberDetails(false);
    }
  };

  const closeFingerprintModal = () => {
    setIsFingerprintModalOpen(false);
    setFingerprintId1('DUMMY_FINGERPRINT_1');
    setFingerprintId2('DUMMY_FINGERPRINT_2');
  };

  const openEditMemberModal = async (memberId: string) => {
    setOpenAction(null);
    setIsEditMemberOpen(true);
    setIsLoadingEditMember(true);
    setEditMemberError('');
    setEditFieldErrors({});
    setEditMemberId(memberId);

    try {
      const response = await getMemberById(memberId);
      const member = response?.additionalData?.response ?? response?.response ?? null;

      if (!member) {
        setEditMemberError('Unable to load member details for editing.');
        return;
      }

      const memberDetails = member as MemberDetails;
      setEditForm({
        firstName: memberDetails.firstName ?? '',
        lastName: memberDetails.lastName ?? '',
        dateOfBirth: formatDateInputValue(memberDetails.dateOfBirth),
        gender: Number(memberDetails.gender) === 2 ? 'Female' : 'Male',
        phone: memberDetails.phoneNumber ?? '',
        email: memberDetails.email ?? '',
      });
    } catch {
      setEditMemberError('Failed to load member details. Please try again.');
    } finally {
      setIsLoadingEditMember(false);
    }
  };

  const closeEditMemberModal = () => {
    setIsEditMemberOpen(false);
    setEditMemberId(null);
    setEditForm(initialMemberEditForm);
    setEditFieldErrors({});
    setEditMemberError('');
    setIsSavingMemberEdit(false);
  };

  const updateEditField = (field: keyof MemberEditForm, value: string) => {
    setEditForm((current) => ({ ...current, [field]: value }));
  };

  const openMembershipModal = async (memberId: string) => {
    setOpenAction(null);
    setIsMembershipModalOpen(true);
    setMembershipMemberId(memberId);
    setMembershipMemberDetails(null);
    setMembershipPlanId('');
    setMembershipPaymentMethod('cash');
    setMembershipChangeError('');
    setIsSavingMembershipChange(false);

    try {
      const response = await getMemberById(memberId);
      const member = response?.additionalData?.response ?? response?.response ?? null;

      if (!member) {
        setMembershipChangeError('Unable to load member details for membership change.');
        return;
      }

      const memberDetails = member as MemberDetails;
      setMembershipMemberDetails(memberDetails);
      setMembershipPlanId(memberDetails.membershipPlanId ?? '');
    } catch {
      setMembershipChangeError('Failed to load member details. Please try again.');
    }
  };

  const closeMembershipModal = () => {
    setIsMembershipModalOpen(false);
    setMembershipMemberId(null);
    setMembershipMemberDetails(null);
    setMembershipPlanId('');
    setMembershipPaymentMethod('cash');
    setMembershipChangeError('');
    setIsSavingMembershipChange(false);
  };

  const openDeleteMemberDialog = (member: TableMember) => {
    if (!canDeleteMember(member)) {
      setOpenAction(null);
      return;
    }

    setOpenAction(null);
    setDeleteMemberTarget(member);
    setDeleteMemberError('');
  };

  const closeDeleteMemberDialog = () => {
    setDeleteMemberTarget(null);
    setDeleteMemberError('');
    setIsDeletingMember(false);
  };

  const handleConfirmDeleteMember = async () => {
    if (!deleteMemberTarget) return;

    setIsDeletingMember(true);
    setDeleteMemberError('');

    try {
      await softDeleteMember(deleteMemberTarget.id);

      setPageAlert({
        visible: true,
        variant: 'success',
        title: 'Delete Request Sent',
        description: 'The deletion request has been submitted for super admin approval.',
      });

      closeDeleteMemberDialog();
      await fetchMembers();
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Failed to submit delete request.';
      setDeleteMemberError(message);
      setPageAlert({
        visible: true,
        variant: 'error',
        title: 'Delete Failed',
        description: message,
      });
    } finally {
      setIsDeletingMember(false);
    }
  };

  const buildEditPayload = () => ({
    firstName: editForm.firstName.trim(),
    lastName: editForm.lastName.trim(),
    email: editForm.email.trim(),
    phone: editForm.phone.trim() ? editForm.phone.trim() : null,
    dateOfBirth: (function toIso(d: string) {
      if (!d) return '';
      const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return '';
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const day = Number(m[3]);
      return new Date(Date.UTC(y, mo - 1, day)).toISOString();
    })(editForm.dateOfBirth),
    gender: editForm.gender === 'Female' ? 2 : 1,
  });

  const handleSaveMemberEdit = async () => {
    if (!editMemberId) return;

    const validationErrors = validateMemberEditForm(editForm);
    setEditFieldErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsSavingMemberEdit(true);
    try {
      await updateMember(editMemberId, buildEditPayload());

      setPageAlert({
        visible: true,
        variant: 'success',
        title: 'Member Updated',
        description: 'The member details have been updated successfully.',
      });

      await fetchMembers();

      try {
        const response = await getMemberById(editMemberId);
        const member = response?.additionalData?.response ?? response?.response ?? null;
        if (member) setSelectedMemberDetails(member as MemberDetails);
      } catch {
        // ignore refresh error
      }

      closeEditMemberModal();
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Failed to update member details.';
      setPageAlert({
        visible: true,
        variant: 'error',
        title: 'Update Failed',
        description: message,
      });
    } finally {
      setIsSavingMemberEdit(false);
    }
  };

  const handleSaveMembershipChange = async () => {
    if (!membershipMemberId || !membershipMemberDetails) return;

    const selectedPlan = membershipPlans.find((plan) => plan.id === membershipPlanId);
    if (!selectedPlan) {
      setMembershipChangeError('Select a membership plan to continue.');
      return;
    }

    setIsSavingMembershipChange(true);
    setMembershipChangeError('');

    try {
      const payload = {
        membershipPlanId: membershipPlanId,
        paymentType: membershipPaymentMethod === 'cash' ? 1 : 2,
      } as any;

      await updateMembershipPlan(membershipMemberId, payload);

      setPageAlert({
        visible: true,
        variant: 'success',
        title: 'Membership Updated',
        description: `Membership plan changed to ${selectedPlan.title} and payment was recorded successfully.`,
      });

      await fetchMembers();

      try {
        const response = await getMemberById(membershipMemberId);
        const member = response?.additionalData?.response ?? response?.response ?? null;
        if (member) {
          const memberDetails = member as MemberDetails;
          setMembershipMemberDetails(memberDetails);
          if (selectedMemberDetails?.id === membershipMemberId) {
            setSelectedMemberDetails(memberDetails);
          }
        }
      } catch {
        // ignore refresh error
      }

      closeMembershipModal();
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Failed to update membership.';
      setMembershipChangeError(message);
      setPageAlert({
        visible: true,
        variant: 'error',
        title: 'Membership Update Failed',
        description: message,
      });
    } finally {
      setIsSavingMembershipChange(false);
    }
  };

  const handleSaveFingerprints = async () => {
    if (!selectedMemberDetails) return;

    const payload = {
      deviceFingerprintId1: fingerprintId1.trim() || 'DUMMY_FINGERPRINT_1',
      deviceFingerprintId2: fingerprintId2.trim() || 'DUMMY_FINGERPRINT_2',
    };

    setFingerprintSaveLoading(true);
    try {
      await fingerPrintSave(selectedMemberDetails.id, payload);

      setPageAlert({
        visible: true,
        variant: 'success',
        title: 'Fingerprints Saved',
        description: 'Fingerprint details were saved successfully.',
      });

      try {
        const response = await getMemberById(selectedMemberDetails.id);
        const member = response?.additionalData?.response ?? response?.response ?? null;
        if (member) setSelectedMemberDetails(member as MemberDetails);
      } catch {
        // ignore refresh error
      }

      closeFingerprintModal();
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Failed to save fingerprints. Please try again.';
      setPageAlert({
        visible: true,
        variant: 'error',
        title: 'Fingerprint Save Failed',
        description: message,
      });
    } finally {
      setFingerprintSaveLoading(false);
      window.location.reload(); // Force reload to update fingerprint status in member list, as it is not part of the details response and would require refetching the entire list or updating state manually
    }
  };

  const handleSavePayment = async () => {
    if (!selectedMemberDetails) return;

    const amount = Number(selectedMemberDetails.membershipPlanPrice || 0);
    const methodLabel = paymentMethod === 'card' ? 'Card' : 'Cash';
    const confirmMessage = `Confirm payment of LKR ${amount.toLocaleString()} via ${methodLabel}?` + (paymentRemark.trim() ? `\n\nRemark: ${paymentRemark.trim()}` : '');

    if (!window.confirm(confirmMessage)) return;

    const paymentData: any = {
      amount,
      paymentType: paymentMethod === 'cash' ? 1 : 2,
      paymentStatus: 1,
      transactionReference: null,
    };

    setPayLoading(true);
    try {
      await processPayment(paymentData, selectedMemberDetails.id);

      setPageAlert({
        visible: true,
        variant: 'success',
        title: 'Payment Processed',
        description: `Payment of LKR ${amount.toLocaleString()} via ${methodLabel} was successful.`,
      });

      closePaymentModal();

      // Refresh member details
      try {
        const response = await getMemberById(selectedMemberDetails.id);
        const member = response?.additionalData?.response ?? response?.response ?? null;
        if (member) setSelectedMemberDetails(member as MemberDetails);
      } catch {
        // ignore refresh error
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to process payment. Please try again.';
      setPageAlert({
        visible: true,
        variant: 'error',
        title: 'Payment Failed',
        description: msg,
      });
    } finally {
      setPayLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {pageAlert.visible && (
        <div>
          <Alert variant={pageAlert.variant as any} title={pageAlert.title} description={pageAlert.description} onClose={() => setPageAlert((s) => ({ ...s, visible: false }))} />
        </div>
      )}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Member Registration</h1>
            <p className="text-sm text-gray-500 mt-1">Search for returning members or register a new one</p>
          </div>
          <div className="w-full max-w-md">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-md px-3 py-2 text-sm shadow-sm">
              <Search size={16} className="text-gray-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full outline-none text-sm"
                placeholder="Search by name, phone, member ID, or status..."
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={openNewMemberModal} className="flex items-center gap-2 px-3 py-2.5 bg-primary text-white rounded cursor-pointer bg-blue-700 transition text-sm">
              <Plus size={14} />
              New Member
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-100 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.key;
                const tabCount = members.filter((member) => member.status === tab.key).length;

                return (
                  <button
                    key={tab.key}
                    onClick={() => { setActiveTab(tab.key); setPage(1); }}
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition cursor-pointer ${isActive ? 'bg-gray-900 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    {tab.label}
                    <span className={`inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-xs ${isActive ? 'bg-white/15 text-white' : 'bg-white text-gray-600'}`}>
                      {tabCount}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="text-sm text-gray-600">
              {tabs.find((tab) => tab.key === activeTab)?.label}
            </div>
          </div>

          <div className="px-4 py-3">
            <div className="overflow-x-auto">
              <table className="w-full table-auto text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-600 border-b border-gray-100">
                    <th className="py-2 px-3">MEMBER</th>
                    <th className="py-2 px-3">AGE</th>
                    <th className="py-2 px-3">GENDER</th>
                    <th className="py-2 px-3">PHONE</th>
                    <th className="py-2 px-3">STATUS</th>
                    <th className="py-2 px-3">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingMembers ? (
                    <tr>
                      <td colSpan={6} className="py-8">
                        <div className="flex items-center justify-center gap-3">
                          <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                          <span className="text-sm text-gray-600">Loading members...</span>
                        </div>
                      </td>
                    </tr>
                  ) : membersError ? (
                    <tr>
                      <td colSpan={6} className="py-8">
                        <div className="flex items-center justify-center">
                          <span className="text-sm text-red-600">{membersError}</span>
                        </div>
                      </td>
                    </tr>
                  ) : pageItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8">
                        <div className="flex items-center justify-center">
                          <span className="text-sm text-gray-500">No members found</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    pageItems.map((p) => (
                      <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-3 align-top">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-semibold">{p.name.split(' ').map(n => n[0]).slice(0, 2).join('')}</div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">{p.name}</div>
                              <div className="text-xs text-blue-600">{p.pid}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3 align-top text-gray-700">{p.age}</td>
                        <td className="py-2 px-3 align-top"><span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs">{p.gender}</span></td>
                        <td className="py-2 px-3 align-top text-gray-700">{p.phone}</td>
                        <td className="py-2 px-3 align-top">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-700'
                            : p.status === 'pending'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700'
                            }`}>
                            {p.status === 'approved' ? 'Active' : p.status === 'pending' ? 'Inactive' : 'Blocked'}
                          </span>
                        </td>
                        <td className="py-2 px-3 align-top text-gray-500">
                          <div className="relative inline-block">
                            <button onClick={(e) => {
                              e.stopPropagation();
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              const menuWidth = 144; // w-36
                              let left = rect.right - menuWidth;
                              left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
                              const top = rect.bottom + 8;
                              setOpenAction(openAction && openAction.id === p.id ? null : { id: p.id, top, left });
                            }} className="p-1.5 rounded-full hover:bg-gray-100 transition cursor-pointer">
                              <MoreVertical size={14} />
                            </button>
                          </div>

                          {openAction && openAction.id === p.id && createPortal(
                            <div style={{ position: 'fixed', top: openAction.top, left: openAction.left, width: 176 }} onMouseDown={(e) => e.stopPropagation()} className="rounded-md bg-white border shadow-lg z-50">
                              <button onClick={() => openViewMemberModal(p.id)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                                <Eye size={14} /> View
                              </button>
                              <button onClick={() => openEditMemberModal(p.id)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                                <Edit size={14} /> Edit
                              </button>
                              <button onClick={() => openMembershipModal(p.id)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                                <CreditCard size={14} /> Membership
                              </button>
                              <button onClick={() => openUpdateFingerprintsModal(p.id)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                                <Fingerprint size={14} /> Fingerprints
                              </button>
                              {canDeleteMember(p) ? (
                                <button onClick={() => openDeleteMemberDialog(p)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-gray-50 cursor-pointer">
                                  <Trash2 size={14} /> Delete
                                </button>
                              ) : null}
                            </div>,
                            document.body,
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="px-4 py-3 border-t border-gray-100 bg-white flex items-center justify-between">
            <div className="text-sm text-gray-600">Showing {total === 0 ? 0 : start + 1} to {Math.min(start + pageSize, total)} of {total} entries</div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600">Rows:</label>
                <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="border rounded-md px-2 py-1 text-sm">
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                </select>
              </div>
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-3 py-1 cursor-pointer rounded-md border bg-white text-sm disabled:opacity-50">Prev</button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button key={i} onClick={() => setPage(i + 1)} className={`px-2 py-1 text-sm rounded-md ${page === i + 1 ? 'bg-gray-900 text-white' : 'bg-white border'}`}>
                    {i + 1}
                  </button>
                ))}
              </div>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-3 py-1 cursor-pointer rounded-md border bg-white text-sm disabled:opacity-50">Next</button>
            </div>
          </div>
        </div>
      </div>

      {isNewMemberOpen && createPortal(
        <div className="fixed inset-0 z-80 flex items-center justify-center bg-black/50 px-3 py-4 sm:px-4 sm:py-6">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 sm:text-2xl">Register New Member</h2>
                <p className="mt-1 text-sm text-gray-500">Complete all steps to register the member in the system.</p>
              </div>
              <button onClick={closeNewMemberModal} className="rounded-full cursor-pointer p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900">
                <X size={18} />
              </button>
            </div>

            <div className="border-b border-gray-200 px-5 py-4 sm:px-6">
              <div className="mx-auto grid w-full max-w-xl grid-cols-[1fr_auto_1fr_auto_1fr] items-center">
                <div className="flex items-center justify-end pr-4 sm:pr-6">
                  <div className="flex flex-col items-center gap-2 text-center shrink-0">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold ${memberStep >= 1 ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 bg-white text-gray-400'}`}>
                      1
                    </div>
                    <span className={`text-xs font-medium sm:text-sm ${memberStep >= 1 ? 'text-blue-600' : 'text-gray-500'}`}>Personal</span>
                  </div>
                </div>

                <div className="h-px w-16 bg-gray-200 sm:w-20 md:w-24" />

                <div className="flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2 text-center shrink-0">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold ${memberStep >= 2 ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 bg-white text-gray-400'}`}>
                      2
                    </div>
                    <span className={`text-xs font-medium sm:text-sm ${memberStep >= 2 ? 'text-blue-600' : 'text-gray-500'}`}>Payment</span>
                  </div>
                </div>

                <div className="h-px w-16 bg-gray-200 sm:w-20 md:w-24" />

                <div className="flex items-center justify-start pl-4 sm:pl-6">
                  <div className="flex flex-col items-center gap-2 text-center shrink-0">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold ${memberStep >= 3 ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 bg-white text-gray-400'}`}>
                      3
                    </div>
                    <span className={`text-xs font-medium sm:text-sm ${memberStep >= 3 ? 'text-blue-600' : 'text-gray-500'}`}>Fingerprint</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="max-h-[calc(92vh-160px)] overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
              {memberStep === 1 ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                      <UserRound size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-gray-900 sm:text-md">Personal Details</h3>
                      <p className="text-sm text-gray-500">Basic identification information</p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 lg:gap-4">
                    <div>
                      <label className="mb-2 block text-xs font-medium text-gray-900 sm:text-sm">First Name <span className="text-red-500">*</span></label>
                      <input value={form.firstName} onChange={(event) => updateField('firstName', event.target.value)} className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="John" />
                      {fieldErrors.firstName ? <p className="mt-2 text-[11px] text-red-600 sm:text-xs">{fieldErrors.firstName}</p> : null}
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-medium text-gray-900 sm:text-sm">Last Name <span className="text-red-500">*</span></label>
                      <input value={form.lastName} onChange={(event) => updateField('lastName', event.target.value)} className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Doe" />
                      {fieldErrors.lastName ? <p className="mt-2 text-[11px] text-red-600 sm:text-xs">{fieldErrors.lastName}</p> : null}
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-medium text-gray-900 sm:text-sm">Date of Birth <span className="text-red-500">*</span></label>
                      <input type="date" value={form.dateOfBirth} onChange={(event) => updateField('dateOfBirth', event.target.value)} className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                      {fieldErrors.dateOfBirth ? <p className="mt-2 text-[11px] text-red-600 sm:text-xs">{fieldErrors.dateOfBirth}</p> : <p className="mt-2 text-[11px] text-gray-500 sm:text-xs"></p>}
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-medium text-gray-900 sm:text-sm">Gender <span className="text-red-500">*</span></label>
                      <select value={form.gender} onChange={(event) => updateField('gender', event.target.value)} className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                        <option>Male</option>
                        <option>Female</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-medium text-gray-900 sm:text-sm">Phone No <span className="text-red-500">*</span></label>
                      <div className="flex overflow-hidden rounded-lg border border-gray-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                        <span className="border-r border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-500">+94</span>
                        <input value={form.phone} onChange={(event) => updateField('phone', event.target.value)} inputMode="numeric" maxLength={9} className="w-full px-4 py-2.5 text-sm outline-none" placeholder="712 345 678" />
                      </div>
                      <p className={`mt-2 text-[11px] sm:text-xs ${fieldErrors.phone ? 'text-red-600' : 'text-gray-500'}`}>{fieldErrors.phone ?? 'Enter 9 digits starting with 7, without +94.'}</p>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-medium text-gray-900 sm:text-sm">Email <span className="text-red-500">*</span></label>
                      <input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="member@example.com" />
                      <p className={`mt-2 text-[11px] sm:text-xs ${fieldErrors.email ? 'text-red-600' : 'text-gray-500'}`}>{fieldErrors.email ?? 'Use a valid email address.'}</p>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-medium text-gray-900 sm:text-sm">Membership Plan <span className="text-red-500">*</span></label>
                      <select
                        value={form.membershipPlan}
                        onChange={(event) => updateField('membershipPlan', event.target.value)}
                        disabled={isLoadingPlans || membershipPlans.length === 0}
                        className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                      >
                        <option value="">{isLoadingPlans ? 'Loading plans...' : 'Select a plan'}</option>
                        {membershipPlans.map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.title} - LKR {plan.price.toLocaleString()}
                          </option>
                        ))}
                      </select>
                      {plansError ? <p className="mt-2 text-[11px] text-red-600 sm:text-xs">{plansError}</p> : null}
                      {fieldErrors.membershipPlan ? <p className="mt-2 text-[11px] text-red-600 sm:text-xs">{fieldErrors.membershipPlan}</p> : null}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4 mb-5.5">
                    <button onClick={closeNewMemberModal} className="rounded-lg cursor-pointer border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
                      Cancel
                    </button>
                    <button onClick={goToNextStep} disabled={isRegistering} className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400">
                      {isRegistering ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                      {isRegistering ? 'Registering...' : 'Submit & Next'}
                    </button>
                  </div>
                  {submitError ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {submitError}
                    </div>
                  ) : null}
                </div>
              ) : memberStep === 2 ? (
                <div className="space-y-5">
                  <div className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                      <CreditCard size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-gray-900 sm:text-md">Payment</h3>
                      <p className="text-sm text-gray-500">Capture initial payment for the membership.</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-medium text-gray-600">Price</span>
                      <span className="text-base font-semibold text-gray-900">LKR {Number(selectedMembershipPlan?.price || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <label className="mb-3 block text-sm font-medium text-gray-900">Payment Type</label>
                    <div className="flex flex-wrap gap-4">
                      <label className="inline-flex items-center cursor-pointer gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700">
                        <input type="radio" name="regPaymentMethod" value="cash" checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} />
                        Cash
                      </label>
                      <label className="inline-flex items-center cursor-pointer gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700">
                        <input type="radio" name="regPaymentMethod" value="card" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} />
                        Card
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900">Remark <span className="text-gray-400 font-normal">(optional)</span></label>
                    <textarea value={paymentRemark} onChange={(event) => setPaymentRemark(event.target.value)} rows={4} className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Add a remark about the payment..." />
                  </div>

                  <div className="flex items-center justify-between border-t border-gray-200 pt-4 mb-5.5">
                    <button onClick={() => setMemberStep(1)} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
                      <ArrowLeft size={16} />
                      Back
                    </button>
                    <div className="flex items-center gap-3">
                      <button onClick={closeNewMemberModal} className="rounded-lg border cursor-pointer border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
                        Cancel
                      </button>
                      <button onClick={async () => {
                        if (!registeredMemberId) {
                          setPageAlert({ visible: true, variant: 'warning', title: 'No Member', description: 'Member not created yet. Please try again.' });
                          return;
                        }

                        const amt = Number(selectedMembershipPlan?.price || 0);
                        const confirmMsg = `Confirm payment of LKR ${amt.toLocaleString()} via ${paymentMethod === 'card' ? 'Card' : 'Cash'}?` + (paymentRemark.trim() ? `\n\nRemark: ${paymentRemark.trim()}` : '');
                        if (!window.confirm(confirmMsg)) return;

                        setPayLoading(true);
                        try {
                          await processPayment({ amount: amt, paymentType: paymentMethod === 'cash' ? 1 : 2, paymentStatus: 1, transactionReference: null, startDate: new Date().toISOString() }, registeredMemberId);
                          setPageAlert({ visible: true, variant: 'success', title: 'Payment Processed', description: `Payment of LKR ${amt.toLocaleString()} successful.` });
                          try {
                            const detailResp = await getMemberById(registeredMemberId);
                            const member = detailResp?.additionalData?.response ?? detailResp?.response ?? null;
                            if (member) setSelectedMemberDetails(member as MemberDetails);
                          } catch {}
                          setMemberStep(3);
                        } catch (e: any) {
                          const msg = e?.response?.data?.message || e?.message || 'Failed to process payment.';
                          setPageAlert({ visible: true, variant: 'error', title: 'Payment Failed', description: msg });
                        } finally {
                          setPayLoading(false);
                        }
                      }} disabled={payLoading} className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed">
                        {payLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                        {payLoading ? 'Processing...' : 'Pay & Next'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                      <Fingerprint size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-gray-900 sm:text-lg">Fingerprint Scanning</h3>
                      <p className="text-sm text-gray-500">Capture the member fingerprint before submitting.</p>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                    <div className="rounded-3xl border border-dashed border-blue-300 bg-linear-to-b from-blue-50 to-white p-5 sm:p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-blue-700 sm:text-sm">Scanner Ready</p>
                          <h4 className="mt-1 text-lg font-semibold text-gray-900 sm:text-xl">Place Finger on Scanner</h4>
                        </div>
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">Device Connected</span>
                      </div>

                      <div className="mt-6 flex flex-col items-center justify-center rounded-3xl border border-blue-200 bg-white px-5 py-8 text-center shadow-sm sm:mt-8 sm:px-6 sm:py-10">
                        <div className="flex h-24 w-24 items-center justify-center rounded-full border-8 border-blue-100 bg-blue-50 text-blue-600 shadow-inner sm:h-28 sm:w-28">
                          <Fingerprint size={48} strokeWidth={1.8} className="sm:hidden" />
                          <Fingerprint size={56} strokeWidth={1.8} className="hidden sm:block" />
                        </div>
                        <div className="mt-5 space-y-2 sm:mt-6">
                          <p className="text-base font-semibold text-gray-900 sm:text-lg">Fingerprint Scan Pending</p>
                          <p className="text-sm text-gray-500">Use the scanner to capture and verify the member fingerprint.</p>
                        </div>
                        <div className="mt-6 grid w-full gap-3 sm:mt-8 sm:grid-cols-3">
                          <div className="rounded-2xl bg-gray-50 px-4 py-3 text-left">
                            <p className="text-xs uppercase tracking-wide text-gray-400">Status</p>
                            <p className="mt-1 text-sm font-medium text-gray-900">Awaiting scan</p>
                          </div>
                          <div className="rounded-2xl bg-gray-50 px-4 py-3 text-left">
                            <p className="text-xs uppercase tracking-wide text-gray-400">Quality</p>
                            <p className="mt-1 text-sm font-medium text-gray-900">-- %</p>
                          </div>
                          <div className="rounded-2xl bg-gray-50 px-4 py-3 text-left">
                            <p className="text-xs uppercase tracking-wide text-gray-400">Match</p>
                            <p className="mt-1 text-sm font-medium text-gray-900">Not checked</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                        <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Member Summary</h4>
                        <div className="mt-4 space-y-3 text-sm text-gray-600">
                          <div className="flex items-center justify-between gap-4"><span>Name</span><span className="font-medium text-gray-900">{form.firstName || 'John'} {form.lastName || 'Doe'}</span></div>
                          <div className="flex items-center justify-between gap-4"><span>Phone</span><span className="font-medium text-gray-900">+94 {form.phone || '712 345 678'}</span></div>
                          <div className="flex items-center justify-between gap-4">
                            <span>Plan</span>
                            <span className="font-medium text-gray-900">
                              {selectedMembershipPlan ? `${selectedMembershipPlan.title} - LKR ${selectedMembershipPlan.price.toLocaleString()}` : 'Select a plan'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                        <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Scan Actions</h4>
                        <p className="mt-3 text-sm text-gray-600">Connect the fingerprint reader and capture the biometric data before submission.</p>
                        <button className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-gray-800">
                          <Fingerprint size={16} />
                          Start Fingerprint Scan
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-gray-200 pt-4 mb-5.5">
                    <button onClick={goBackStep} className="inline-flex items-center cursor-pointer gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
                      <ArrowLeft size={16} />
                      Back
                    </button>
                    <div className="flex items-center gap-3">
                      <button onClick={closeNewMemberModal} className="rounded-lg border cursor-pointer border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
                        Cancel
                      </button>
                      <button onClick={handleFinalSubmit} disabled={isSubmittingFingerprint} className="inline-flex items-center cursor-pointer gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                        {isSubmittingFingerprint ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                        {isSubmittingFingerprint ? 'Saving...' : 'Submit'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {deleteMemberTarget && createPortal(
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Confirm Delete</h2>
                <p className="mt-1 text-sm text-gray-500">This is a dual authorization process. Super admin can approve or reject the deletion.</p>
              </div>
              <button onClick={closeDeleteMemberDialog} className="rounded-full cursor-pointer p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900">
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-5 space-y-3">
              <p className="text-sm text-gray-700">Are you sure you want to delete?</p>
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <div className="font-medium">{deleteMemberTarget.name}</div>
                <div className="mt-1 text-amber-800">{deleteMemberTarget.pid}</div>
              </div>
              {deleteMemberError ? <p className="text-sm text-red-600">{deleteMemberError}</p> : null}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-5 py-4">
              <button onClick={closeDeleteMemberDialog} className="rounded-lg cursor-pointer border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleConfirmDeleteMember} disabled={isDeletingMember} className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70">
                {isDeletingMember ? <Loader2 size={14} className="animate-spin" /> : null}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {isViewMemberOpen && createPortal(
        <div className="fixed inset-0 z-80 flex items-center justify-center bg-black/50 px-3 py-4 sm:px-4 sm:py-6">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 sm:text-2xl">Member Details</h2>
                <p className="mt-1 text-sm text-gray-500">Complete member profile and membership status.</p>
              </div>
              <button onClick={closeViewMemberModal} className="rounded-full p-2 cursor-pointer text-gray-500 transition hover:bg-gray-100 hover:text-gray-900">
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[calc(92vh-88px)] overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
              {isLoadingMemberDetails ? (
                <div className="flex min-h-[280px] items-center justify-center gap-3">
                  <Loader2 size={20} className="animate-spin text-blue-600" />
                  <span className="text-sm text-gray-600">Loading member details...</span>
                </div>
              ) : memberDetailsError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {memberDetailsError}
                </div>
              ) : selectedMemberDetails ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                      <UserRound size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-gray-900 sm:text-md">Profile Overview</h3>
                      <p className="text-sm text-gray-500">Information fetched from member profile API.</p>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                      <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Personal Details</h4>
                      <div className="mt-4 space-y-3 text-sm text-gray-600">
                        <div className="flex items-center justify-between gap-4"><span>Member No</span><span className="font-medium text-gray-900">{selectedMemberDetails.membershipNumber}</span></div>
                        <div className="flex items-center justify-between gap-4"><span>Name</span><span className="font-medium text-gray-900">{selectedMemberDetails.firstName} {selectedMemberDetails.lastName}</span></div>
                        <div className="flex items-center justify-between gap-4"><span>Email</span><span className="font-medium text-gray-900">{selectedMemberDetails.email}</span></div>
                        <div className="flex items-center justify-between gap-4"><span>Phone</span><span className="font-medium text-gray-900">{selectedMemberDetails.phoneNumber ? `+94${selectedMemberDetails.phoneNumber}` : 'N/A'}</span></div>
                        <div className="flex items-center justify-between gap-4"><span>Date of Birth</span><span className="font-medium text-gray-900">{formatDisplayDate(selectedMemberDetails.dateOfBirth)}</span></div>
                        <div className="flex items-center justify-between gap-4"><span>Gender</span><span className="font-medium text-gray-900">{selectedMemberDetails.gender === 1 ? 'Male' : 'Female'}</span></div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                      <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Membership Details</h4>
                      <div className="mt-4 space-y-3 text-sm text-gray-600">
                        <div className="flex items-center justify-between gap-4"><span>Status</span><span className="font-medium text-gray-900">{selectedMemberDetails.membershipStatus}</span></div>
                        <div className="flex items-center justify-between gap-4"><span>Plan</span><span className="font-medium text-gray-900">{selectedMemberDetails.membershipPlanTitle}</span></div>
                        <div className="flex items-center justify-between gap-4"><span>Price</span><span className="font-medium text-gray-900">LKR {Number(selectedMemberDetails.membershipPlanPrice || 0).toLocaleString()}</span></div>
                        <div className="flex items-center justify-between gap-4"><span>Duration</span><span className="font-medium text-gray-900">{selectedMemberDetails.membershipPlanDurationInDays} days</span></div>
                        <div className="flex items-center justify-between gap-4"><span>Start Date</span><span className="font-medium text-gray-900">{formatDisplayDate(selectedMemberDetails.membershipStartDate)}</span></div>
                        <div className="flex items-center justify-between gap-4"><span>End Date</span><span className="font-medium text-gray-900">{formatDisplayDate(selectedMemberDetails.membershipEndDate)}</span></div>
                        <div className="flex items-center justify-between gap-4">
                          <span>Payment Status</span>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${selectedMemberDetails.paymentStatus === 1
                            ? 'bg-amber-100 text-amber-700'
                            : selectedMemberDetails.paymentStatus === 2 || selectedMemberDetails.paymentStatus === 4
                              ? 'bg-emerald-100 text-emerald-700'
                              : selectedMemberDetails.paymentStatus === 3
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                            {paymentStatusLabel(selectedMemberDetails.paymentStatus)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span>Fingerprints</span>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${selectedMemberDetails.isSavedFingerprints ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {selectedMemberDetails.isSavedFingerprints ? 'Saved' : 'Not Saved'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 pt-4">
                    <button onClick={openPaymentModal} className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700">
                      <CreditCard size={16} />
                      Pay
                    </button>
                    {!selectedMemberDetails.isSavedFingerprints && selectedMemberDetails.paymentStatus !== 1 ? (
                      <button onClick={openFingerprintModal} className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700">
                        <Fingerprint size={16} />
                        Fingerprints
                      </button>
                    ) : null}
                    <button onClick={closeViewMemberModal} className="rounded-lg cursor-pointer border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
                      Close
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {isPayModalOpen && createPortal(
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 px-3 py-4 sm:px-4 sm:py-6">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 sm:text-2xl">Payment</h2>
                <p className="mt-1 text-sm text-gray-500">Capture the member payment details.</p>
              </div>
              <button onClick={closePaymentModal} className="rounded-full p-2 cursor-pointer text-gray-500 transition hover:bg-gray-100 hover:text-gray-900">
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[calc(92vh-88px)] overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
              <div className="space-y-4">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-gray-600">Price</span>
                    <span className="text-base font-semibold text-gray-900">
                      LKR {Number(selectedMemberDetails?.membershipPlanPrice || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <label className="mb-3 block text-sm font-medium text-gray-900">Payment Type</label>
                  <div className="flex flex-wrap gap-4">
                    <label className="inline-flex items-center cursor-pointer gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700">
                      <input type="radio" name="paymentMethod" value="cash" checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} />
                      Cash
                    </label>
                    <label className="inline-flex items-center cursor-pointer gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700">
                      <input type="radio" name="paymentMethod" value="card" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} />
                      Card
                    </label>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900">Remark <span className="text-gray-400 font-normal">(optional)</span></label>
                  <textarea
                    value={paymentRemark}
                    onChange={(event) => setPaymentRemark(event.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Add a remark about the payment..."
                  />
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
                  <button onClick={closePaymentModal} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 cursor-pointer">
                    Cancel
                  </button>
                  <button onClick={handleSavePayment} disabled={payLoading} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-700 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
                    {payLoading ? <Loader2 size={16} className="animate-spin" /> : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {isFingerprintModalOpen && createPortal(
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 px-3 py-4 sm:px-4 sm:py-6">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 sm:text-2xl">Fingerprints</h2>
                <p className="mt-1 text-sm text-gray-500">Save fingerprint values for this member.</p>
              </div>
              <button onClick={closeFingerprintModal} className="rounded-full p-2 cursor-pointer text-gray-500 transition hover:bg-gray-100 hover:text-gray-900">
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[calc(92vh-88px)] overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
              <div className="space-y-4">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-gray-600">Member</span>
                    <span className="text-sm font-semibold text-gray-900">{selectedMemberDetails?.membershipNumber}</span>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900">Fingerprint ID 1</label>
                  <input
                    value={fingerprintId1}
                    onChange={(event) => setFingerprintId1(event.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="DUMMY_FINGERPRINT_1"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900">Fingerprint ID 2</label>
                  <input
                    value={fingerprintId2}
                    onChange={(event) => setFingerprintId2(event.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="DUMMY_FINGERPRINT_2"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
                  <button onClick={closeFingerprintModal} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 cursor-pointer">
                    Cancel
                  </button>
                  <button onClick={handleSaveFingerprints} disabled={fingerprintSaveLoading} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-700 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
                    {fingerprintSaveLoading ? <Loader2 size={16} className="animate-spin" /> : <Fingerprint size={16} />}
                    {fingerprintSaveLoading ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {isEditMemberOpen && createPortal(
        <div className="fixed inset-0 z-[96] flex items-center justify-center bg-black/60 px-3 py-4 sm:px-4 sm:py-6">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 sm:text-2xl">Edit Member</h2>
                <p className="mt-1 text-sm text-gray-500">Update member details.</p>
              </div>
              <button onClick={closeEditMemberModal} className="rounded-full p-2 cursor-pointer text-gray-500 transition hover:bg-gray-100 hover:text-gray-900">
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[calc(92vh-88px)] overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
              {isLoadingEditMember ? (
                <div className="flex min-h-[280px] items-center justify-center gap-3">
                  <Loader2 size={20} className="animate-spin text-blue-600" />
                  <span className="text-sm text-gray-600">Loading member details...</span>
                </div>
              ) : editMemberError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {editMemberError}
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                      <UserRound size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-gray-900 sm:text-md">Member Details</h3>
                      <p className="text-sm text-gray-500">Editable profile fields for this member.</p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 lg:gap-4">
                    <div>
                      <label className="mb-2 block text-xs font-medium text-gray-900 sm:text-sm">First Name <span className="text-red-500">*</span></label>
                      <input value={editForm.firstName} onChange={(event) => updateEditField('firstName', event.target.value)} className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="John" />
                      {editFieldErrors.firstName ? <p className="mt-2 text-[11px] text-red-600 sm:text-xs">{editFieldErrors.firstName}</p> : null}
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-medium text-gray-900 sm:text-sm">Last Name <span className="text-red-500">*</span></label>
                      <input value={editForm.lastName} onChange={(event) => updateEditField('lastName', event.target.value)} className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Doe" />
                      {editFieldErrors.lastName ? <p className="mt-2 text-[11px] text-red-600 sm:text-xs">{editFieldErrors.lastName}</p> : null}
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-medium text-gray-900 sm:text-sm">Date of Birth <span className="text-red-500">*</span></label>
                      <input type="date" value={editForm.dateOfBirth} onChange={(event) => updateEditField('dateOfBirth', event.target.value)} className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                      {editFieldErrors.dateOfBirth ? <p className="mt-2 text-[11px] text-red-600 sm:text-xs">{editFieldErrors.dateOfBirth}</p> : null}
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-medium text-gray-900 sm:text-sm">Gender <span className="text-red-500">*</span></label>
                      <select value={editForm.gender} onChange={(event) => updateEditField('gender', event.target.value)} className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                        <option>Male</option>
                        <option>Female</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-medium text-gray-900 sm:text-sm">Phone No <span className="text-red-500">*</span></label>
                      <div className="flex overflow-hidden rounded-lg border border-gray-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                        <span className="border-r border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-500">+94</span>
                        <input value={editForm.phone} onChange={(event) => updateEditField('phone', event.target.value)} inputMode="numeric" maxLength={9} className="w-full px-4 py-2.5 text-sm outline-none" placeholder="712 345 678" />
                      </div>
                      <p className={`mt-2 text-[11px] sm:text-xs ${editFieldErrors.phone ? 'text-red-600' : 'text-gray-500'}`}>{editFieldErrors.phone ?? 'Enter 9 digits starting with 7, without +94.'}</p>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-medium text-gray-900 sm:text-sm">Email <span className="text-red-500">*</span></label>
                      <input type="email" value={editForm.email} onChange={(event) => updateEditField('email', event.target.value)} className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="member@example.com" />
                      <p className={`mt-2 text-[11px] sm:text-xs ${editFieldErrors.email ? 'text-red-600' : 'text-gray-500'}`}>{editFieldErrors.email ?? 'Use a valid email address.'}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
                    <button onClick={closeEditMemberModal} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 cursor-pointer">
                      Cancel
                    </button>
                    <button onClick={handleSaveMemberEdit} disabled={isSavingMemberEdit} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-700 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
                      {isSavingMemberEdit ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                      {isSavingMemberEdit ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {isMembershipModalOpen && createPortal(
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 px-3 py-4 sm:px-4 sm:py-6">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 sm:text-2xl">Membership</h2>
                <p className="mt-1 text-sm text-gray-500">Change the selected member's membership plan and payment method.</p>
              </div>
              <button onClick={closeMembershipModal} className="rounded-full p-2 cursor-pointer text-gray-500 transition hover:bg-gray-100 hover:text-gray-900">
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[calc(92vh-88px)] overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
              {membershipChangeError && !membershipMemberDetails ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {membershipChangeError}
                </div>
              ) : membershipMemberDetails ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-medium text-gray-600">Member</span>
                      <span className="text-sm font-semibold text-gray-900">{membershipMemberDetails.membershipNumber}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-4">
                      <span className="text-sm font-medium text-gray-600">Current Plan</span>
                      <span className="text-sm font-semibold text-gray-900">{membershipMemberDetails.membershipPlanTitle}</span>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900">Membership Plan</label>
                    <select
                      value={membershipPlanId}
                      onChange={(event) => setMembershipPlanId(event.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="">Select a plan</option>
                      {membershipPlans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.title} - LKR {plan.price.toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-medium text-gray-600">Selected Price</span>
                      <span className="text-base font-semibold text-gray-900">
                        LKR {Number(selectedMembershipChangePlan?.price || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <label className="mb-3 block text-sm font-medium text-gray-900">Payment Type</label>
                    <div className="flex flex-wrap gap-4">
                      <label className="inline-flex items-center cursor-pointer gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700">
                        <input type="radio" name="membershipPaymentMethod" value="cash" checked={membershipPaymentMethod === 'cash'} onChange={() => setMembershipPaymentMethod('cash')} />
                        Cash
                      </label>
                      <label className="inline-flex items-center cursor-pointer gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700">
                        <input type="radio" name="membershipPaymentMethod" value="card" checked={membershipPaymentMethod === 'card'} onChange={() => setMembershipPaymentMethod('card')} />
                        Card
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
                    <button onClick={closeMembershipModal} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 cursor-pointer">
                      Cancel
                    </button>
                    <button onClick={handleSaveMembershipChange} disabled={isSavingMembershipChange || !membershipPlanId} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-700 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
                      {isSavingMembershipChange ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                      {isSavingMembershipChange ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[220px] items-center justify-center gap-3">
                  <Loader2 size={20} className="animate-spin text-blue-600" />
                  <span className="text-sm text-gray-600">Loading member details...</span>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}

    </div>
  );
}
