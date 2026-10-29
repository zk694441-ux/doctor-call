import React, { useEffect, useState } from 'react';
import { FaCheck, FaEnvelope, FaLock, FaTimes, FaUser } from 'react-icons/fa';
import SocialSignUp from './SocialSignUp';
import Spinner from 'react-bootstrap/Spinner';
import swal from 'sweetalert';
import { useDoctorSignUpMutation, usePatientSignUpMutation } from '../../redux/api/authApi';
import { message } from 'antd';

const SignUp = ({ setSignUp }) => {
    const [loading, setLoading] = useState(false);
    const formField = {
        firstName: '',
        lastName: '',
        email: '',
        password: '',
    };
    const [user, setUser] = useState(formField);
    const [userType, setUserType] = useState('patient');
    const [doctorSignUp, { data: dData, isSuccess: dIsSuccess, isError: dIsError, error: dError, isLoading: dIsLoading }] = useDoctorSignUpMutation();
    const [patientSignUp, { data: pData, isSuccess: pIsSuccess, isError: pIsError, error: pError, isLoading: pIsLoading }] = usePatientSignUpMutation();
    const [passwordValidation, setPasswordValidation] = useState({
        carLength: false,
        specailChar: false,
        upperLowerCase: false,
        numeric: false
    });
    const [emailError, setEmailError] = useState({
        emailError: false
    });

    const handleSignUpSuccess = () => {
        setLoading(false);
        setUser(formField);
    };

    useEffect(() => {
        // Doctor account
        if (dIsError && dError) {
            const errorMsg = dError?.data?.message || dError?.error || "Failed to create doctor account!";
            message.error(errorMsg);
            setLoading(false);
        }

        if (!dIsError && dIsSuccess) {
            handleSignUpSuccess();
            swal({
                icon: 'success',
                text: `Successfully Doctor Account Created! Please Login.`,
                timer: 3000
            });
            setSignUp(false);
        }

        // Patient account
        if (pIsError && pError) {
            const errorMsg = pError?.data?.message || pError?.error || "Failed to create patient account!";
            message.error(errorMsg);
            setLoading(false);
        }

        if (!pIsError && pIsSuccess) {
            handleSignUpSuccess();
            setSignUp(false);
            swal({
                icon: 'success',
                text: `Successfully Patient Account Created! Please Login.`,
                timer: 2000
            });
        }
    }, [dIsError, dError, pError, pIsError, pIsLoading, dIsLoading, pData, dData, setSignUp, dIsSuccess, pIsSuccess]);

    const handleEmailError = (name, value) => {
        if (name === 'email') {
            setEmailError({
                emailError: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
            });
        }
    };

    const hanldeValidation = (name, value) => {
        if (name === 'password') {
            setPasswordValidation({
                carLength: value.length >= 8,
                specailChar: /[ `!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~]/.test(value),
                upperLowerCase: /^(?=.*[a-z])(?=.*[A-Z])/.test(value),
                numeric: /^(?=.*\d)/.test(value),
            });
        }
    };

    const hanldeOnChange = (e) => {
        const { name, value } = e.target;
        if (name === 'password') {
            hanldeValidation(name, value);
        }
        if (name === 'email') {
            handleEmailError(name, value);
        }
        setUser((prev) => ({ ...prev, [name]: value }));
    };

    const handleUserTypeChange = (e) => {
        setUserType(e.target.value);
    };

    const hanldeOnSubmit = async (e) => {
        e.preventDefault();
        if (!user.firstName.trim() || !user.lastName.trim()) {
            message.error("Please enter both First Name and Last Name.");
            return;
        }
        setLoading(true);
        if (userType === "doctor") {
            doctorSignUp(user);
        } else {
            patientSignUp(user);
        }
    };

    const isFormValid =
        passwordValidation.carLength &&
        passwordValidation.numeric &&
        passwordValidation.upperLowerCase &&
        passwordValidation.specailChar &&
        emailError.emailError &&
        user.firstName.trim().length > 0 &&
        user.lastName.trim().length > 0;

    return (
        <form className="sign-up-form" onSubmit={hanldeOnSubmit}>
            <div className="alert alert-warning small text-start mb-3" role="alert">
                <strong>Fair use:</strong> Do not misuse this app or create accounts you do not need. Patient sign-up uses email +
                password only. Admin accounts are not created here — they are added
                in the database with <code>role = admin</code>.
            </div>
            <h2 className="title">Sign Up</h2>
            <div className="input-field">
                <span className="fIcon"><FaUser /></span>
                <input placeholder="First Name" name="firstName" type="text" onChange={hanldeOnChange} value={user.firstName} required />
            </div>
            <div className="input-field">
                <span className="fIcon"><FaUser /></span>
                <input placeholder="Last Name" name="lastName" type="text" onChange={hanldeOnChange} value={user.lastName} required />
            </div>
            <div className="input-field">
                <span className="fIcon"><FaEnvelope /></span>
                <input placeholder="Email" name="email" type="email" onChange={hanldeOnChange} value={user.email} required />
            </div>
            <div className="input-field">
                <span className="fIcon"><FaLock /></span>
                <input type="password" name="password" placeholder="Password" onChange={hanldeOnChange} value={user.password} required />
            </div>
            <div className='input-field d-flex align-items-center gap-2 justify-content-center'>
                <div className='text-nowrap'>I'M A</div>
                <select
                    className="form-select w-50"
                    aria-label="select"
                    onChange={handleUserTypeChange}
                    defaultValue='patient'
                >
                    <option value="patient">Patient</option>
                    <option value="doctor">Doctor</option>
                </select>
            </div>
            <button
                type="submit"
                className="btn btn-primary btn-block mt-2 iBtn"
                disabled={!isFormValid || loading}
            >
                {loading ? <Spinner animation="border" variant="info" size="sm" /> : "Sign Up"}
            </button>

            <div className="password-validatity mx-auto mt-2">
                <div style={emailError.emailError ? { color: "green" } : { color: "red" }}>
                    <p>{emailError.emailError ? <FaCheck /> : <FaTimes />}
                        <span className="ms-2">Must Have Valid Email.</span></p>
                </div>

                <div style={passwordValidation.carLength ? { color: "green" } : { color: "red" }}>
                    <p>{passwordValidation.carLength ? <FaCheck /> : <FaTimes />}
                        <span className="ms-2">Password Must Have at least 8 characters.</span></p>
                </div>

                <div style={passwordValidation.specailChar ? { color: "green" } : { color: "red" }}>
                    <p>{passwordValidation.specailChar ? <FaCheck /> : <FaTimes />}
                        <span className="ms-2">Password Must Have a special character.</span></p>
                </div>

                <div style={passwordValidation.upperLowerCase ? { color: "green" } : { color: "red" }}>
                    <p>{passwordValidation.upperLowerCase ? <FaCheck /> : <FaTimes />}
                        <span className="ms-2">Password Must Have uppercase and lowercase.</span></p>
                </div>

                <div style={passwordValidation.numeric ? { color: "green" } : { color: "red" }}>
                    <p>{passwordValidation.numeric ? <FaCheck /> : <FaTimes />}
                        <span className="ms-2">Password Must Have a number.</span></p>
                </div>
            </div>

            <p className="social-text">Or Sign up with social account</p>
            <SocialSignUp />
        </form>
    );
};

export default SignUp;
