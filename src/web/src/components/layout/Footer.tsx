/**
 * @fileoverview Footer component providing consistent bottom navigation and information
 * @version 1.0.0
 * 
 * Implements:
 * - WCAG 2.1 Level AA compliance
 * - Responsive design with mobile-first approach
 * - Theme-aware styling with dark mode support
 * - 8px grid spacing system
 */

import React, { useMemo } from 'react';
import styled from 'styled-components';
import { lightTheme, darkTheme, breakpoints } from '../../config/theme';

// Props interface for Footer component
interface FooterProps {
  className?: string;
}

// Helper function to get current year
const getCurrentYear = (): number => new Date().getFullYear();

// Styled components with responsive and accessible design
const FooterContainer = styled.footer`
  background-color: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.text};
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.md};
  width: 100%;
  contain: layout;
  border-top: 1px solid ${({ theme }) => theme.colors.border};

  @media (min-width: ${breakpoints.tablet}) {
    padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.lg};
  }
`;

const FooterContent = styled.div`
  max-width: ${breakpoints.large};
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr;
  gap: ${({ theme }) => theme.spacing.lg};
  
  @media (min-width: ${breakpoints.tablet}) {
    grid-template-columns: repeat(3, 1fr);
    gap: ${({ theme }) => theme.spacing.xl};
  }
`;

const FooterSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};

  h3 {
    font-size: calc(${({ theme }) => theme.typography.baseSize} * 1.2);
    font-weight: ${({ theme }) => theme.typography.weights.bold};
    margin-bottom: ${({ theme }) => theme.spacing.sm};
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  li {
    margin-bottom: ${({ theme }) => theme.spacing.sm};
  }

  a {
    color: ${({ theme }) => theme.colors.text};
    text-decoration: none;
    transition: color 0.2s ease;
    
    &:hover {
      color: ${({ theme }) => theme.colors.primary};
    }

    &:focus-visible {
      outline: 2px solid ${({ theme }) => theme.colors.primary};
      outline-offset: 2px;
    }
  }
`;

const Copyright = styled.p`
  text-align: center;
  font-size: calc(${({ theme }) => theme.typography.baseSize} * 0.9);
  margin-top: ${({ theme }) => theme.spacing.xl};
  color: ${({ theme }) => theme.colors.secondary};
`;

/**
 * Footer component providing consistent bottom navigation and information
 * Implements responsive design and accessibility features
 */
export const Footer: React.FC<FooterProps> = ({ className }) => {
  // Memoize current year calculation
  const currentYear = useMemo(() => getCurrentYear(), []);

  return (
    <FooterContainer className={className} role="contentinfo">
      <FooterContent>
        <FooterSection>
          <h3>Company</h3>
          <ul>
            <li><a href="/about">About Us</a></li>
            <li><a href="/careers">Careers</a></li>
            <li><a href="/contact">Contact</a></li>
          </ul>
        </FooterSection>

        <FooterSection>
          <h3>Resources</h3>
          <ul>
            <li><a href="/help">Help Center</a></li>
            <li><a href="/documentation">Documentation</a></li>
            <li><a href="/status">System Status</a></li>
          </ul>
        </FooterSection>

        <FooterSection>
          <h3>Legal</h3>
          <ul>
            <li><a href="/privacy">Privacy Policy</a></li>
            <li><a href="/terms">Terms of Service</a></li>
            <li><a href="/security">Security</a></li>
          </ul>
        </FooterSection>
      </FooterContent>

      <Copyright>
        © {currentYear} Task Management System. All rights reserved.
      </Copyright>
    </FooterContainer>
  );
};

export default Footer;