import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin, Download } from 'lucide-react';
import { triggerInstallPrompt } from './InstallPrompt';

const Footer = () => {
  return (
    <footer className="bg-secondary-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1">
            <Link to="/" className="mb-4 inline-flex rounded-lg bg-white px-2 py-1">
              <img src="/logo.png" alt="TheHomeDesigners.in" className="h-12 w-auto object-contain" />
            </Link>
            <p className="text-gray-300 mb-4">
              Premium home interior design services across India. Transform your space with our expert designers.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li><Link to="/designers" className="text-gray-300 hover:text-accent-400 transition-colors">Find Designers</Link></li>
              <li><Link to="/projects" className="text-gray-300 hover:text-accent-400 transition-colors">Project Portfolio</Link></li>
              <li><a href="#" className="text-gray-300 hover:text-accent-400 transition-colors">About Us</a></li>
              <li>
                <button
                  onClick={triggerInstallPrompt}
                  className="flex items-center gap-1.5 text-gray-300 hover:text-accent-400 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Install App
                </button>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Services</h3>
            <ul className="space-y-2">
              <li className="text-gray-300">Residential Design</li>
              <li className="text-gray-300">Commercial Spaces</li>
              <li className="text-gray-300">Kitchen Design</li>
              <li className="text-gray-300">Bathroom Renovation</li>
              <li className="text-gray-300">3D Visualization</li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact Info</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Mail className="w-4 h-4 text-accent-400" />
                <span className="text-gray-300">supportcontact@thehomedesigners.in</span>
              </div>
              <div className="flex items-start space-x-3">
                <MapPin className="w-4 h-4 text-accent-400 mt-1" />
                <span className="text-gray-300">Across Pune</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-8 pt-8 text-center">
          <p className="text-gray-300">
            © 2024 TheHomeDesigners. All rights reserved. Crafting beautiful homes across India.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;